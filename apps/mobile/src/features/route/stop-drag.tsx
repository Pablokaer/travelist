// Drag and drop for the route's stop list, next to the move up / move down buttons.
// Built on the core PanResponder (not react-native-gesture-handler) so it works on web, iOS and
// Android without a GestureHandlerRootView at the app root.
import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  PanResponder,
  Platform,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/components/icon';
import { MIN_TOUCH } from '@/theme/colors';
import { useTheme } from '@/theme/use-theme';

/** A row's vertical box inside the list, as reported by onLayout. */
export type RowBox = { y: number; height: number };

/** The row being dragged and how far the pointer has moved since the drag started. */
export type StopDragState = { from: number; dy: number };

/**
 * Where a row dragged by `dy` lands: the number of other rows whose centre is above its centre.
 * @example dropIndex([{ y: 0, height: 60 }, { y: 70, height: 60 }], 0, 50); // 1
 */
export function dropIndex(rows: readonly RowBox[], from: number, dy: number): number {
  const dragged = rows[from];
  if (!dragged) return from;
  const centre = dragged.y + dragged.height / 2 + dy;
  return rows.filter((r, k) => k !== from && r.y + r.height / 2 < centre).length;
}

/**
 * Vertical offset of row `index` while the row at `from` hovers over position `to`: the rows in
 * between slide by the dragged row's height (plus the list gap) to open a slot for it.
 * @example rowShift(1, 0, 2, 60, 4); // -64 — row 1 moves up to make room below it
 */
export function rowShift(index: number, from: number, to: number, height: number, gap: number) {
  if (index > from && index <= to) return -(height + gap);
  if (index < from && index >= to) return height + gap;
  return 0;
}

/**
 * Drag state for one list: measures rows, tracks the dragged row and reports the drop.
 * @example const drag = useStopDrag((from, to) => store.moveTo(route[from].id, to));
 */
export function useStopDrag(onDrop: (from: number, to: number) => void) {
  const [rows, setRows] = useState<RowBox[]>([]);
  const [drag, setDrag] = useState<StopDragState | null>(null);
  const measure = (index: number) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setRows((prev) => Object.assign([...prev], { [index]: { y, height } }));
  };
  const end = (from: number, dy: number) => {
    setDrag(null);
    const to = dropIndex(rows, from, dy);
    if (to !== from) onDrop(from, to);
  };
  const target = drag ? dropIndex(rows, drag.from, drag.dy) : null;
  const heightOf = (index: number) => rows[index]?.height ?? 0;
  return { drag, target, measure, heightOf, move: setDrag, end };
}

type DragHandleProps = {
  index: number;
  accessibilityLabel: string;
  onDragMove: (state: StopDragState) => void;
  onDragEnd: (from: number, dy: number) => void;
};

/** Pan gestures on the grip; every callback reads the handle's current props from `latest`. */
function createDragResponder(latest: RefObject<DragHandleProps>) {
  const current = () => latest.current;
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => current().onDragMove({ from: current().index, dy: 0 }),
    onPanResponderMove: (_, g) => current().onDragMove({ from: current().index, dy: g.dy }),
    onPanResponderRelease: (_, g) => current().onDragEnd(current().index, g.dy),
    onPanResponderTerminate: (_, g) => current().onDragEnd(current().index, g.dy),
  });
}

/** The grip a stop is dragged by; claims the gesture so the page doesn't scroll instead. */
export function DragHandle(props: DragHandleProps) {
  const theme = useTheme();
  // The responder is created once; its callbacks read the latest props (index changes after a drop).
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  // eslint-disable-next-line react-hooks/refs -- the ref is only read inside gesture callbacks
  const [responder] = useState(() => createDragResponder(latest));
  return (
    <View
      {...responder.panHandlers}
      accessibilityLabel={props.accessibilityLabel}
      testID={`drag-stop-${props.index}`}
      style={[styles.handle, webGrab]}>
      <Icon name="dragHandle" size={20} color={theme.textSecondary} />
    </View>
  );
}

// Web: a grab cursor, and touch screens neither scroll the page nor select text on the grip.
const webGrab =
  Platform.OS === 'web'
    ? ({ cursor: 'grab', touchAction: 'none', userSelect: 'none' } as unknown as ViewStyle)
    : null;

const styles = StyleSheet.create({
  handle: {
    width: MIN_TOUCH - 8,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
