// VIA Metropolitan Transit API Configuration
// Developer Resources: https://www.viainfo.net/developers-resources/
// GTFS-RT feeds provide real-time vehicle positions, trip updates, and service alerts

export const VIA_API = {
  // Static GTFS schedule feed (zip)
  GTFS_STATIC: "https://www.viainfo.net/BusService/google_transit.zip",

  // GTFS-RT Protocol Buffer feeds
  VEHICLE_POSITIONS: "https://gtfs.viainfo.net/vehicle/vehiclepositions.pb",
  TRIP_UPDATES: "https://gtfs.viainfo.net/tripupdate/tripupdates.pb",
  SERVICE_ALERTS: "https://gtfs.viainfo.net/alert/alerts.pb",

  // VIA REST API (Swagger: https://gtfsapi.viainfo.net/index.html)
  REST_BASE: "https://gtfsapi.viainfo.net",

  // VIA ArcGIS Open Data (bus stops/routes GIS layers)
  // https://data-viatransit.opendata.arcgis.com/
  ARCGIS_OPEN_DATA: "https://data-viatransit.opendata.arcgis.com",

  // Refresh intervals (milliseconds)
  VEHICLE_REFRESH_MS: 10_000, // 10 seconds for live bus positions
  ALERTS_REFRESH_MS: 30_000, // 30 seconds for service alerts
  TRIPS_REFRESH_MS: 15_000, // 15 seconds for trip updates
} as const;

// San Antonio Bike Infrastructure
// Source: City of San Antonio Open Data (CoSAGIS)
// https://opendata-cosagis.opendata.arcgis.com/datasets/bike-facilities/about
export const BIKE_API = {
  FACILITIES_GEOJSON:
    "https://opendata-cosagis.opendata.arcgis.com/api/download/v1/items/754d5490121e44b8b6f3712934b24839/geojson?layers=0",
  FACILITIES_CSV:
    "https://opendata-cosagis.opendata.arcgis.com/api/download/v1/items/8b498e0c26c6400a8bf2acd7fc784003/csv?layers=0",
  FACILITIES_FEATURE_SERVER:
    "https://services.arcgis.com/g1fRTDLeMgspWrYp/arcgis/rest/services/BikeFacilities/FeatureServer/0/query",
  // SA Bike Network Plan: https://sabikenetwork.com/
  // Interactive map: https://gis.sanantonio.gov/TCI/Bike/index.html
} as const;

// San Antonio map center coordinates
export const SA_CENTER = {
  latitude: 29.4241,
  longitude: -98.4936,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
} as const;

// Focus areas for bike routes
export const BIKE_FOCUS_AREAS = {
  pearl: { latitude: 29.4425, longitude: -98.4800, name: "Pearl District" },
  broadway: { latitude: 29.4500, longitude: -98.4750, name: "Broadway" },
  stMarys: { latitude: 29.4300, longitude: -98.4950, name: "St. Mary's" },
  zoo: { latitude: 29.4175, longitude: -98.5175, name: "San Antonio Zoo" },
  riverwalk: { latitude: 29.4230, longitude: -98.4890, name: "Riverwalk" },
  downtown: { latitude: 29.4241, longitude: -98.4936, name: "Downtown" },
} as const;

// Google Maps API (user must provide their own key)
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

// Theme colors
export const COLORS = {
  primary: "#0066CC",
  primaryDark: "#004C99",
  accent: "#FF6B35",
  background: "#1a1a2e",
  surface: "#16213e",
  surfaceLight: "#0f3460",
  text: "#FFFFFF",
  textSecondary: "#B0B0B0",
  success: "#4CAF50",
  warning: "#FF9800",
  error: "#F44336",
  busActive: "#4CAF50",
  busDelayed: "#FF9800",
  busInactive: "#9E9E9E",
  bikeRoute: "#00E676",
  bikeLane: "#76FF03",
  bikePath: "#00BFA5",
  bikeTrail: "#18FFFF",
} as const;
