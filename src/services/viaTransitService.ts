import { VIA_API } from "../constants/config";
import type {
  VehiclePosition,
  TripUpdate,
  ServiceAlert,
  TransitRoute,
  StopTimeUpdate,
} from "../types/transit";
import {
  VehicleStopStatus,
  AlertCause,
  AlertEffect,
  AlertSeverity,
} from "../types/transit";

// GTFS-RT Protocol Buffer decoder
// VIA provides standard GTFS-RT protobuf feeds
// We decode them using a lightweight approach compatible with React Native

interface PbEntity {
  id?: string;
  vehicle?: {
    trip?: { tripId?: string; routeId?: string };
    vehicle?: { id?: string; label?: string; licensePlate?: string };
    position?: {
      latitude?: number;
      longitude?: number;
      bearing?: number;
      speed?: number;
    };
    currentStopSequence?: number;
    currentStatus?: number;
    timestamp?: number | string;
    occupancyStatus?: number;
  };
  tripUpdate?: {
    trip?: { tripId?: string; routeId?: string };
    vehicle?: { id?: string };
    timestamp?: number | string;
    delay?: number;
    stopTimeUpdate?: Array<{
      stopSequence?: number;
      stopId?: string;
      arrival?: { delay?: number; time?: number | string; uncertainty?: number };
      departure?: { delay?: number; time?: number | string; uncertainty?: number };
      scheduleRelationship?: number;
    }>;
  };
  alert?: {
    activePeriod?: Array<{ start?: number | string; end?: number | string }>;
    informedEntity?: Array<{
      agencyId?: string;
      routeId?: string;
      routeType?: number;
      stopId?: string;
      trip?: { tripId?: string };
    }>;
    cause?: number;
    effect?: number;
    url?: { translation?: Array<{ text?: string }> };
    headerText?: { translation?: Array<{ text?: string }> };
    descriptionText?: { translation?: Array<{ text?: string }> };
    severityLevel?: number;
  };
}

interface PbFeed {
  header?: { gtfsRealtimeVersion?: string; timestamp?: number | string };
  entity?: PbEntity[];
}

// Lightweight GTFS-RT protobuf decoder
// Decodes the binary protobuf format used by VIA's GTFS-RT feeds
function decodeVarint(buf: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length) {
    const byte = buf[pos];
    result |= (byte & 0x7f) << shift;
    pos++;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result, pos];
}

function decodeFixed32(buf: Uint8Array, offset: number): number {
  return (
    buf[offset] |
    (buf[offset + 1] << 8) |
    (buf[offset + 2] << 16) |
    (buf[offset + 3] << 24)
  );
}

function decodeFixed64AsNumber(buf: Uint8Array, offset: number): number {
  const low = decodeFixed32(buf, offset);
  const high = decodeFixed32(buf, offset + 4);
  return low + high * 0x100000000;
}

function decodeFloat(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 4);
  return view.getFloat32(0, true);
}

function decodeDouble(buf: Uint8Array, offset: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
  return view.getFloat64(0, true);
}

interface ProtoField {
  fieldNumber: number;
  wireType: number;
  value: Uint8Array | number;
}

function decodeMessage(buf: Uint8Array): ProtoField[] {
  const fields: ProtoField[] = [];
  let pos = 0;
  while (pos < buf.length) {
    const [tag, nextPos] = decodeVarint(buf, pos);
    pos = nextPos;
    const fieldNumber = tag >>> 3;
    const wireType = tag & 0x7;

    if (wireType === 0) {
      // Varint
      const [value, newPos] = decodeVarint(buf, pos);
      fields.push({ fieldNumber, wireType, value });
      pos = newPos;
    } else if (wireType === 1) {
      // 64-bit
      fields.push({ fieldNumber, wireType, value: buf.slice(pos, pos + 8) });
      pos += 8;
    } else if (wireType === 2) {
      // Length-delimited
      const [length, newPos] = decodeVarint(buf, pos);
      pos = newPos;
      fields.push({
        fieldNumber,
        wireType,
        value: buf.slice(pos, pos + length),
      });
      pos += length;
    } else if (wireType === 5) {
      // 32-bit
      fields.push({ fieldNumber, wireType, value: buf.slice(pos, pos + 4) });
      pos += 4;
    } else {
      break; // Unknown wire type
    }
  }
  return fields;
}

function getString(field: ProtoField): string {
  if (field.wireType === 2 && field.value instanceof Uint8Array) {
    return new TextDecoder().decode(field.value);
  }
  return String(field.value);
}

function getNumber(field: ProtoField): number {
  if (typeof field.value === "number") return field.value;
  if (field.value instanceof Uint8Array) {
    if (field.wireType === 5) return decodeFloat(field.value, 0);
    if (field.wireType === 1) return decodeDouble(field.value, 0);
  }
  return 0;
}

function getSubMessage(field: ProtoField): ProtoField[] {
  if (field.wireType === 2 && field.value instanceof Uint8Array) {
    return decodeMessage(field.value);
  }
  return [];
}

function findField(fields: ProtoField[], num: number): ProtoField | undefined {
  return fields.find((f) => f.fieldNumber === num);
}

function findAllFields(fields: ProtoField[], num: number): ProtoField[] {
  return fields.filter((f) => f.fieldNumber === num);
}

// Parse GTFS-RT FeedMessage from raw protobuf
function parseFeedMessage(buf: Uint8Array): PbFeed {
  const feedFields = decodeMessage(buf);
  const entities: PbEntity[] = [];

  const entityFields = findAllFields(feedFields, 2); // entity = field 2
  for (const ef of entityFields) {
    const entFields = getSubMessage(ef);
    const entity: PbEntity = {};

    const idField = findField(entFields, 1);
    if (idField) entity.id = getString(idField);

    // Vehicle position (field 4)
    const vehicleField = findField(entFields, 4);
    if (vehicleField) {
      const vf = getSubMessage(vehicleField);
      entity.vehicle = {};

      const tripField = findField(vf, 1);
      if (tripField) {
        const tf = getSubMessage(tripField);
        entity.vehicle.trip = {
          tripId: findField(tf, 1) ? getString(findField(tf, 1)!) : undefined,
          routeId: findField(tf, 5) ? getString(findField(tf, 5)!) : undefined,
        };
      }

      const vehField = findField(vf, 8);
      if (vehField) {
        const vhf = getSubMessage(vehField);
        entity.vehicle.vehicle = {
          id: findField(vhf, 1) ? getString(findField(vhf, 1)!) : undefined,
          label: findField(vhf, 2) ? getString(findField(vhf, 2)!) : undefined,
        };
      }

      const posField = findField(vf, 2);
      if (posField) {
        const pf = getSubMessage(posField);
        entity.vehicle.position = {
          latitude: findField(pf, 1) ? getNumber(findField(pf, 1)!) : undefined,
          longitude: findField(pf, 2) ? getNumber(findField(pf, 2)!) : undefined,
          bearing: findField(pf, 3) ? getNumber(findField(pf, 3)!) : undefined,
          speed: findField(pf, 4) ? getNumber(findField(pf, 4)!) : undefined,
        };
      }

      const seqField = findField(vf, 3);
      if (seqField) entity.vehicle.currentStopSequence = getNumber(seqField);

      const statusField = findField(vf, 4);
      if (statusField) entity.vehicle.currentStatus = getNumber(statusField);

      const tsField = findField(vf, 5);
      if (tsField) entity.vehicle.timestamp = getNumber(tsField);
    }

    // Trip update (field 3)
    const tuField = findField(entFields, 3);
    if (tuField) {
      const tuf = getSubMessage(tuField);
      entity.tripUpdate = {};

      const tripField = findField(tuf, 1);
      if (tripField) {
        const tf = getSubMessage(tripField);
        entity.tripUpdate.trip = {
          tripId: findField(tf, 1) ? getString(findField(tf, 1)!) : undefined,
          routeId: findField(tf, 5) ? getString(findField(tf, 5)!) : undefined,
        };
      }

      const vehField = findField(tuf, 3);
      if (vehField) {
        const vhf = getSubMessage(vehField);
        entity.tripUpdate.vehicle = {
          id: findField(vhf, 1) ? getString(findField(vhf, 1)!) : undefined,
        };
      }

      const tsField = findField(tuf, 4);
      if (tsField) entity.tripUpdate.timestamp = getNumber(tsField);

      const delayField = findField(tuf, 5);
      if (delayField) entity.tripUpdate.delay = getNumber(delayField);

      const stuFields = findAllFields(tuf, 2);
      entity.tripUpdate.stopTimeUpdate = stuFields.map((stuf) => {
        const sf = getSubMessage(stuf);
        return {
          stopSequence: findField(sf, 1) ? getNumber(findField(sf, 1)!) : undefined,
          stopId: findField(sf, 4) ? getString(findField(sf, 4)!) : undefined,
          arrival: findField(sf, 2)
            ? (() => {
                const af = getSubMessage(findField(sf, 2)!);
                return {
                  delay: findField(af, 1) ? getNumber(findField(af, 1)!) : undefined,
                  time: findField(af, 2) ? getNumber(findField(af, 2)!) : undefined,
                };
              })()
            : undefined,
          departure: findField(sf, 3)
            ? (() => {
                const df = getSubMessage(findField(sf, 3)!);
                return {
                  delay: findField(df, 1) ? getNumber(findField(df, 1)!) : undefined,
                  time: findField(df, 2) ? getNumber(findField(df, 2)!) : undefined,
                };
              })()
            : undefined,
        };
      });
    }

    // Alert (field 5)
    const alertField = findField(entFields, 5);
    if (alertField) {
      const af = getSubMessage(alertField);
      entity.alert = {};

      const apFields = findAllFields(af, 1);
      entity.alert.activePeriod = apFields.map((apf) => {
        const p = getSubMessage(apf);
        return {
          start: findField(p, 1) ? getNumber(findField(p, 1)!) : undefined,
          end: findField(p, 2) ? getNumber(findField(p, 2)!) : undefined,
        };
      });

      const ieFields = findAllFields(af, 5);
      entity.alert.informedEntity = ieFields.map((ief) => {
        const ie = getSubMessage(ief);
        return {
          agencyId: findField(ie, 1) ? getString(findField(ie, 1)!) : undefined,
          routeId: findField(ie, 2) ? getString(findField(ie, 2)!) : undefined,
          stopId: findField(ie, 4) ? getString(findField(ie, 4)!) : undefined,
        };
      });

      const causeField = findField(af, 6);
      if (causeField) entity.alert.cause = getNumber(causeField);

      const effectField = findField(af, 7);
      if (effectField) entity.alert.effect = getNumber(effectField);

      const headerField = findField(af, 10);
      if (headerField) {
        const hf = getSubMessage(headerField);
        const transFields = findAllFields(hf, 1);
        entity.alert.headerText = {
          translation: transFields.map((tf) => {
            const t = getSubMessage(tf);
            return { text: findField(t, 1) ? getString(findField(t, 1)!) : "" };
          }),
        };
      }

      const descField = findField(af, 11);
      if (descField) {
        const df = getSubMessage(descField);
        const transFields = findAllFields(df, 1);
        entity.alert.descriptionText = {
          translation: transFields.map((tf) => {
            const t = getSubMessage(tf);
            return { text: findField(t, 1) ? getString(findField(t, 1)!) : "" };
          }),
        };
      }

      const sevField = findField(af, 14);
      if (sevField) entity.alert.severityLevel = getNumber(sevField);
    }

    entities.push(entity);
  }

  return { entity: entities };
}

// Fetch and parse vehicle positions from VIA GTFS-RT feed
export async function fetchVehiclePositions(): Promise<VehiclePosition[]> {
  try {
    const response = await fetch(VIA_API.VEHICLE_POSITIONS);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const feed = parseFeedMessage(new Uint8Array(buffer));

    if (!feed.entity) return [];

    return feed.entity
      .filter((e) => e.vehicle?.position?.latitude && e.vehicle?.position?.longitude)
      .map((e) => ({
        vehicleId: e.vehicle!.vehicle?.id || e.id || "unknown",
        tripId: e.vehicle!.trip?.tripId || "",
        routeId: e.vehicle!.trip?.routeId || "",
        latitude: e.vehicle!.position!.latitude!,
        longitude: e.vehicle!.position!.longitude!,
        bearing: e.vehicle!.position?.bearing || 0,
        speed: e.vehicle!.position?.speed || 0,
        timestamp: Number(e.vehicle!.timestamp) || Date.now() / 1000,
        label: e.vehicle!.vehicle?.label || e.vehicle!.trip?.routeId || "",
        currentStopSequence: e.vehicle!.currentStopSequence,
        currentStatus: e.vehicle!.currentStatus as VehicleStopStatus,
      }));
  } catch (error) {
    console.error("Failed to fetch vehicle positions:", error);
    return [];
  }
}

// Fetch and parse trip updates (delays) from VIA GTFS-RT feed
export async function fetchTripUpdates(): Promise<TripUpdate[]> {
  try {
    const response = await fetch(VIA_API.TRIP_UPDATES);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const feed = parseFeedMessage(new Uint8Array(buffer));

    if (!feed.entity) return [];

    return feed.entity
      .filter((e) => e.tripUpdate)
      .map((e) => {
        const tu = e.tripUpdate!;
        const stopTimeUpdates: StopTimeUpdate[] = (tu.stopTimeUpdate || []).map(
          (stu) => ({
            stopSequence: stu.stopSequence || 0,
            stopId: stu.stopId || "",
            arrival: stu.arrival
              ? { delay: stu.arrival.delay, time: Number(stu.arrival.time) }
              : undefined,
            departure: stu.departure
              ? { delay: stu.departure.delay, time: Number(stu.departure.time) }
              : undefined,
          })
        );

        // Calculate max delay from stop time updates
        let maxDelay = tu.delay || 0;
        for (const stu of stopTimeUpdates) {
          if (stu.arrival?.delay && stu.arrival.delay > maxDelay) {
            maxDelay = stu.arrival.delay;
          }
          if (stu.departure?.delay && stu.departure.delay > maxDelay) {
            maxDelay = stu.departure.delay;
          }
        }

        return {
          tripId: tu.trip?.tripId || "",
          routeId: tu.trip?.routeId || "",
          vehicleId: tu.vehicle?.id,
          timestamp: Number(tu.timestamp) || Date.now() / 1000,
          delay: maxDelay,
          stopTimeUpdates,
        };
      });
  } catch (error) {
    console.error("Failed to fetch trip updates:", error);
    return [];
  }
}

// Fetch and parse service alerts from VIA GTFS-RT feed
export async function fetchServiceAlerts(): Promise<ServiceAlert[]> {
  try {
    const response = await fetch(VIA_API.SERVICE_ALERTS);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const buffer = await response.arrayBuffer();
    const feed = parseFeedMessage(new Uint8Array(buffer));

    if (!feed.entity) return [];

    return feed.entity
      .filter((e) => e.alert)
      .map((e) => {
        const a = e.alert!;
        return {
          id: e.id || String(Math.random()),
          headerText:
            a.headerText?.translation?.[0]?.text || "Service Alert",
          descriptionText:
            a.descriptionText?.translation?.[0]?.text || "",
          cause: (a.cause as AlertCause) || AlertCause.UNKNOWN_CAUSE,
          effect: (a.effect as AlertEffect) || AlertEffect.UNKNOWN_EFFECT,
          activePeriods: (a.activePeriod || []).map((p) => ({
            start: Number(p.start) || undefined,
            end: Number(p.end) || undefined,
          })),
          informedEntities: (a.informedEntity || []).map((ie) => ({
            agencyId: ie.agencyId,
            routeId: ie.routeId,
            stopId: ie.stopId,
            tripId: ie.trip?.tripId,
          })),
          url: a.url?.translation?.[0]?.text,
          severity:
            (a.severityLevel as AlertSeverity) || AlertSeverity.INFO,
        };
      });
  } catch (error) {
    console.error("Failed to fetch service alerts:", error);
    return [];
  }
}

// Build route summary from vehicle positions and trip updates
export function buildRoutesSummary(
  vehicles: VehiclePosition[],
  tripUpdates: TripUpdate[],
  alerts: ServiceAlert[]
): TransitRoute[] {
  const routeMap = new Map<
    string,
    { vehicles: number; maxDelay: number; hasAlerts: boolean }
  >();

  // Count vehicles per route
  for (const v of vehicles) {
    const existing = routeMap.get(v.routeId) || {
      vehicles: 0,
      maxDelay: 0,
      hasAlerts: false,
    };
    existing.vehicles++;
    routeMap.set(v.routeId, existing);
  }

  // Add delay info
  for (const tu of tripUpdates) {
    const existing = routeMap.get(tu.routeId) || {
      vehicles: 0,
      maxDelay: 0,
      hasAlerts: false,
    };
    if (tu.delay > existing.maxDelay) {
      existing.maxDelay = tu.delay;
    }
    routeMap.set(tu.routeId, existing);
  }

  // Add alert info
  for (const alert of alerts) {
    for (const entity of alert.informedEntities) {
      if (entity.routeId) {
        const existing = routeMap.get(entity.routeId) || {
          vehicles: 0,
          maxDelay: 0,
          hasAlerts: false,
        };
        existing.hasAlerts = true;
        routeMap.set(entity.routeId, existing);
      }
    }
  }

  return Array.from(routeMap.entries())
    .map(([routeId, data]) => ({
      routeId,
      shortName: routeId,
      longName: `Route ${routeId}`,
      color: "#0066CC",
      textColor: "#FFFFFF",
      type: 3, // Bus
      activeVehicles: data.vehicles,
      hasAlerts: data.hasAlerts,
      maxDelay: data.maxDelay,
    }))
    .sort((a, b) => {
      const aNum = parseInt(a.routeId, 10);
      const bNum = parseInt(b.routeId, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return a.routeId.localeCompare(b.routeId);
    });
}
