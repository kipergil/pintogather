import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GripVertical, Milestone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { haversineDistanceKm, sortPinsForRoute } from "@shared/geo";

export interface RoutePin {
  id: string;
  title: string;
  latitude: string;
  longitude: string;
  note?: string;
  sequence?: number | null;
  createdAt: string;
}

interface RouteViewProps {
  shareUrl: string;
  pins: RoutePin[];
  isOwner: boolean;
}

/** Drag-to-reorder itinerary list, with a running distance-between-stops readout — used alongside the map's route polyline (see simple-google-map.tsx's routeOrder prop). */
export function RouteView({ shareUrl, pins, isOwner }: RouteViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orderedIds, setOrderedIds] = useState<string[]>(() => sortPinsForRoute(pins).map((p) => p.id));

  // Re-derive the local order whenever the *set* of pin ids changes (a pin
  // was added/removed/approved elsewhere) — but not on every render, so an
  // in-progress drag isn't clobbered by an unrelated background refetch.
  const idsKey = [...pins.map((p) => p.id)].sort().join(",");
  useEffect(() => {
    setOrderedIds(sortPinsForRoute(pins).map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const reorderMutation = useMutation({
    mutationFn: async (pinIds: string[]) => {
      await apiRequest("PUT", `/api/maps/${shareUrl}/pins/reorder`, { pinIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/maps/${shareUrl}`] });
    },
    onError: (error: any) => {
      toast({ title: "Couldn't save the new order", description: error.message || "Please try again", variant: "destructive" });
      setOrderedIds(sortPinsForRoute(pins).map((p) => p.id));
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const pinById = new Map(pins.map((p) => [p.id, p]));
  const orderedPins = orderedIds.map((id) => pinById.get(id)).filter((p): p is RoutePin => !!p);
  const totalKm = orderedPins.reduce((sum, pin, i) => {
    if (i === 0) return sum;
    return sum + haversineDistanceKm(orderedPins[i - 1], pin);
  }, 0);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedIds((prev) => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      const next = arrayMove(prev, oldIndex, newIndex);
      reorderMutation.mutate(next);
      return next;
    });
  };

  if (orderedPins.length === 0) {
    return <p className="text-sm text-muted-foreground/50 italic">No pins to route yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Milestone className="h-4 w-4" />
        {totalKm.toFixed(1)} km total, as the crow flies
        {isOwner && orderedPins.length > 1 && <span className="text-xs text-muted-foreground/70">— drag stops to reorder</span>}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {orderedPins.map((pin, index) => (
              <RouteRow
                key={pin.id}
                pin={pin}
                index={index}
                distanceFromPrev={index === 0 ? null : haversineDistanceKm(orderedPins[index - 1], pin)}
                draggable={isOwner}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function RouteRow({
  pin,
  index,
  distanceFromPrev,
  draggable,
}: {
  pin: RoutePin;
  index: number;
  distanceFromPrev: number | null;
  draggable: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pin.id,
    disabled: !draggable,
  });

  return (
    <Card
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="border-border"
      data-testid={`row-route-pin-${pin.id}`}
    >
      <CardContent className="p-3 flex items-center gap-3">
        {draggable && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
            aria-label="Drag to reorder"
            data-testid={`button-drag-pin-${pin.id}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground text-sm truncate">{pin.title}</div>
          {pin.note && <p className="text-xs text-muted-foreground truncate">{pin.note}</p>}
        </div>
        {distanceFromPrev !== null && (
          <div className="shrink-0 text-xs text-muted-foreground">{distanceFromPrev.toFixed(1)} km</div>
        )}
      </CardContent>
    </Card>
  );
}
