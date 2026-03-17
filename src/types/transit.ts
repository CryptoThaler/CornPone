// VIA Metropolitan Transit data types

export interface VehiclePosition {
  vehicleId: string;
  tripId: string;
  routeId: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
  timestamp: number;
  label: string;
  licensePlate?: string;
  currentStopSequence?: number;
  currentStatus?: VehicleStopStatus;
  occupancyStatus?: OccupancyStatus;
}

export enum VehicleStopStatus {
  INCOMING_AT = 0,
  STOPPED_AT = 1,
  IN_TRANSIT_TO = 2,
}

export enum OccupancyStatus {
  EMPTY = 0,
  MANY_SEATS_AVAILABLE = 1,
  FEW_SEATS_AVAILABLE = 2,
  STANDING_ROOM_ONLY = 3,
  CRUSHED_STANDING_ROOM_ONLY = 4,
  FULL = 5,
  NOT_ACCEPTING_PASSENGERS = 6,
}

export interface TripUpdate {
  tripId: string;
  routeId: string;
  vehicleId?: string;
  timestamp: number;
  delay: number; // seconds of delay (positive = late)
  stopTimeUpdates: StopTimeUpdate[];
}

export interface StopTimeUpdate {
  stopSequence: number;
  stopId: string;
  arrival?: TimeEvent;
  departure?: TimeEvent;
  scheduleRelationship?: ScheduleRelationship;
}

export interface TimeEvent {
  delay?: number;
  time?: number;
  uncertainty?: number;
}

export enum ScheduleRelationship {
  SCHEDULED = 0,
  SKIPPED = 1,
  NO_DATA = 2,
}

export interface ServiceAlert {
  id: string;
  headerText: string;
  descriptionText: string;
  cause: AlertCause;
  effect: AlertEffect;
  activePeriods: TimePeriod[];
  informedEntities: InformedEntity[];
  url?: string;
  severity: AlertSeverity;
}

export enum AlertCause {
  UNKNOWN_CAUSE = 1,
  OTHER_CAUSE = 2,
  TECHNICAL_PROBLEM = 3,
  STRIKE = 4,
  DEMONSTRATION = 5,
  ACCIDENT = 6,
  HOLIDAY = 7,
  WEATHER = 8,
  MAINTENANCE = 9,
  CONSTRUCTION = 10,
  POLICE_ACTIVITY = 11,
  MEDICAL_EMERGENCY = 12,
}

export enum AlertEffect {
  NO_SERVICE = 1,
  REDUCED_SERVICE = 2,
  SIGNIFICANT_DELAYS = 3,
  DETOUR = 4,
  ADDITIONAL_SERVICE = 5,
  MODIFIED_SERVICE = 6,
  OTHER_EFFECT = 7,
  UNKNOWN_EFFECT = 8,
  STOP_MOVED = 9,
}

export enum AlertSeverity {
  INFO = 1,
  WARNING = 2,
  SEVERE = 3,
}

export interface TimePeriod {
  start?: number;
  end?: number;
}

export interface InformedEntity {
  agencyId?: string;
  routeId?: string;
  routeType?: number;
  stopId?: string;
  tripId?: string;
}

export interface TransitRoute {
  routeId: string;
  shortName: string;
  longName: string;
  color: string;
  textColor: string;
  type: number;
  activeVehicles: number;
  hasAlerts: boolean;
  maxDelay: number;
}

export interface BikeFeature {
  id: string;
  type: "bike_lane" | "bike_path" | "bike_route" | "bike_trail" | "shared_lane";
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  status: "existing" | "planned" | "under_construction";
}
