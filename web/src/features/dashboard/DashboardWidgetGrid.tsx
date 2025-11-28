/**
 * DashboardWidgetGrid Component
 * 
 * Renders dashboard widgets in a draggable grid layout with glassmorphic cards.
 * Supports full-width and half-width widgets with drag & drop reordering.
 */

import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useDashboardLayout } from '../../hooks/useDashboardLayout';
import { DashboardWidgetConfig } from './dashboardWidgets';
import clsx from 'clsx';
import { WalletOverview } from '../../components/wallet/WalletOverview';
import { MonthlySnapshotCard } from '../../components/dashboard/MonthlySnapshotCard';
import { DashboardChartsHub } from '../../components/dashboard/DashboardChartsHub';
import { MonthGlanceCard } from './components/MonthGlanceCard';
import { CoachStoryCard } from '../../features/coach/components/CoachStoryCard';
import { AchievementsTeaser } from '../../features/achievements/components/AchievementsTeaser';
import { QuestStrip } from '../../features/quests/QuestStrip';
import { MoneyHealthCard } from './components/MoneyHealthCard';

// Widget component props interfaces (passed from parent Dashboard)
export interface DashboardWidgetGridProps {
  // Wallet widget props
  walletFresh?: boolean;
  
  // Month snapshot props
  monthlyInsights?: any;
  
  // Charts props
  balanceOverTime?: any[];
  cashflowByMonth?: any[];
  categorySlices?: any[];
  chartsLoading?: boolean;
  dateRangeLabel?: string;
  onCategoryClick?: (categoryId: string) => void;
  
  // Month glance props
  monthSummary?: any;
  monthSummaryLoading?: boolean;
  monthSummaryError?: Error | null;
  monthSummaryFresh?: boolean;
  onMonthSummaryRefresh?: () => void;
  
  // Coach story props
  coachStory?: any;
  coachStoryLoading?: boolean;
  coachStoryError?: Error | null;
  coachStoryFresh?: boolean;
  onCoachStoryRefresh?: () => void;
  
  // Achievements props
  achievementsFresh?: boolean;
  
  // Quests props
  quests?: any[];
  questsLoading?: boolean;
  questsError?: string | null;
  onQuestsRefresh?: () => void;
  
  // Edit mode
  editMode?: boolean;
  onEditModeChange?: (enabled: boolean) => void;
}

interface DashboardWidgetItemProps {
  widget: DashboardWidgetConfig;
  gridProps: DashboardWidgetGridProps;
  editMode: boolean;
}

/**
 * Individual sortable widget item
 */
function DashboardWidgetItem({ widget, gridProps, editMode }: DashboardWidgetItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    disabled: !editMode, // Only draggable in edit mode
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const widthClass =
    widget.size === 'full'
      ? 'col-span-12'
      : 'col-span-12 md:col-span-6';

  // Render widget content based on widget ID
  const renderWidgetContent = () => {
    switch (widget.id) {
      case 'wallet':
        return <WalletOverview gridColumns={2} isFresh={gridProps.walletFresh} />;
      
      case 'moneyHealth':
        return <MoneyHealthCard />;
      
      case 'monthSnapshot':
        return <MonthlySnapshotCard insights={gridProps.monthlyInsights} noCard />;
      
      case 'charts':
        return (
          <DashboardChartsHub
            balance={gridProps.balanceOverTime ?? []}
            cashflow={gridProps.cashflowByMonth ?? []}
            categorySlices={gridProps.categorySlices ?? []}
            loading={gridProps.chartsLoading ?? false}
            dateRangeLabel={gridProps.dateRangeLabel}
            onCategoryClick={gridProps.onCategoryClick}
          />
        );
      
      case 'monthGlance':
        return (
          <MonthGlanceCard
            summary={gridProps.monthSummary?.summary || null}
            narrative={gridProps.monthSummary?.narrative || null}
            isLoading={gridProps.monthSummaryLoading ?? false}
            error={gridProps.monthSummaryError}
            onRefresh={gridProps.onMonthSummaryRefresh}
            isFresh={gridProps.monthSummaryFresh}
          />
        );
      
      case 'coachStory':
        return (
          <CoachStoryCard
            storyResponse={gridProps.coachStory || null}
            isLoading={gridProps.coachStoryLoading ?? false}
            error={gridProps.coachStoryError}
            onRefresh={gridProps.onCoachStoryRefresh}
            isFresh={gridProps.coachStoryFresh}
          />
        );
      
      case 'achievements':
        return <AchievementsTeaser isFresh={gridProps.achievementsFresh} />;
      
      case 'quests':
        return (
          <QuestStrip
            quests={gridProps.quests ?? []}
            isLoading={gridProps.questsLoading}
            error={gridProps.questsError}
            onRefresh={gridProps.onQuestsRefresh}
          />
        );
      
      default:
        return <div className="p-4 text-nf-text-muted">Unknown widget: {widget.id}</div>;
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={widthClass}>
      <div
        className={clsx(
          'nf-card-glass p-6',
          editMode && 'cursor-move ring-2 ring-cyan-400/30 shadow-cyan-500/20',
          !editMode && 'cursor-default',
          'transition-all duration-200',
          'relative z-0' // Ensure sheen effect layers correctly
        )}
      >
        {/* Drag handle - only visible in edit mode */}
        {editMode && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 right-2 text-slate-400 hover:text-cyan-400 transition-colors z-20"
            aria-label="Drag to reorder"
          >
            <GripVertical size={16} />
          </div>
        )}
        
        {/* Widget content - relative z-index to appear above sheen */}
        <div className={clsx('relative z-10', editMode && 'pr-6')}>
          {renderWidgetContent()}
        </div>
      </div>
    </div>
  );
}

/**
 * Main widget grid component with drag & drop
 */
export function DashboardWidgetGrid(props: DashboardWidgetGridProps) {
  const { widgets, reorder } = useDashboardLayout();
  const [editMode, setEditMode] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = widgets.findIndex(w => w.id === active.id);
    const newIndex = widgets.findIndex(w => w.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;

    reorder(oldIndex, newIndex);
  };

  // Use edit mode from props if provided, otherwise use local state
  const isEditMode = props.editMode ?? editMode;
  const handleEditModeChange = props.onEditModeChange ?? setEditMode;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={widgets.map(w => w.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid grid-cols-12 gap-6">
          {widgets.map(widget => (
            <DashboardWidgetItem
              key={widget.id}
              widget={widget}
              gridProps={props}
              editMode={isEditMode}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

