import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/constants/config";
import { useTransitData } from "../../src/hooks/useTransitData";
import { RouteCard } from "../../src/components/RouteCard";
import type { TransitRoute } from "../../src/types/transit";

type SortMode = "number" | "vehicles" | "delay";

export default function RoutesScreen() {
  const { routes, isLoading, refreshAll, vehicles, tripUpdates } =
    useTransitData();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("number");

  const filteredRoutes = useMemo(() => {
    let result = routes;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.shortName.toLowerCase().includes(q) ||
          r.longName.toLowerCase().includes(q) ||
          r.routeId.toLowerCase().includes(q)
      );
    }

    switch (sortMode) {
      case "vehicles":
        return [...result].sort((a, b) => b.activeVehicles - a.activeVehicles);
      case "delay":
        return [...result].sort((a, b) => b.maxDelay - a.maxDelay);
      default:
        return result;
    }
  }, [routes, search, sortMode]);

  const delayedCount = routes.filter((r) => r.maxDelay > 120).length;

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color={COLORS.textSecondary}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search routes..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort controls */}
      <View style={styles.sortRow}>
        <SortButton
          label="Route #"
          active={sortMode === "number"}
          onPress={() => setSortMode("number")}
        />
        <SortButton
          label="Most Active"
          active={sortMode === "vehicles"}
          onPress={() => setSortMode("vehicles")}
        />
        <SortButton
          label="Most Delayed"
          active={sortMode === "delay"}
          onPress={() => setSortMode("delay")}
        />
      </View>

      {/* Summary stats */}
      <View style={styles.statsRow}>
        <Text style={styles.statText}>
          {routes.length} routes · {vehicles.length} buses
        </Text>
        {delayedCount > 0 && (
          <Text style={[styles.statText, { color: COLORS.warning }]}>
            {delayedCount} delayed
          </Text>
        )}
      </View>

      {/* Route list */}
      <FlatList
        data={filteredRoutes}
        keyExtractor={(item) => item.routeId}
        renderItem={({ item }) => (
          <RouteCard
            route={item}
            onPress={() =>
              router.push({
                pathname: "/route/[id]",
                params: { id: item.routeId },
              })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshAll}
            tintColor={COLORS.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bus-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {isLoading
                ? "Loading VIA routes..."
                : search
                  ? "No routes match your search"
                  : "No active routes"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

function SortButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.sortButton, active && styles.sortButtonActive]}
      onPress={onPress}
    >
      <Text
        style={[styles.sortButtonText, active && styles.sortButtonTextActive]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
  },
  sortRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  sortButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
  },
  sortButtonActive: {
    backgroundColor: COLORS.primary,
  },
  sortButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
  sortButtonTextActive: {
    color: COLORS.text,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 20,
  },
  empty: {
    alignItems: "center",
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});
