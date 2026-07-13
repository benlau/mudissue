import { defineMessages } from "react-intl";
import { intl } from "../../intl.ts";
import { useAppStore } from "../../store/AppStore.ts";
import { useCurrentTrackerRepoStore } from "../../store/CurrentTrackerRepoStore.ts";
import { RegistryService } from "../../services/RegistryService.ts";
import { useToastStore } from "../../store/ToastStore.ts";
import type { PaletteCommand } from "../../types/PaletteCommand.ts";
import type {
  SortingOrder,
  SortingOrderField,
} from "../../types/SortingOrder.ts";
import {
  PickItemDialogResponseType,
  usePickItemDialogStore,
} from "../components/PickItemDialog.tsx";

const messages = defineMessages({
  label: {
    id: "views.paletteCommands.setSortingOrder.label",
    defaultMessage: "Set Sort Order",
  },
  description: {
    id: "views.paletteCommands.setSortingOrder.description",
    defaultMessage: "Choose how issues are sorted in the list",
  },
  pickFieldTitle: {
    id: "views.paletteCommands.setSortingOrder.pickFieldTitle",
    defaultMessage: "Sort by",
  },
  pickOrderTitle: {
    id: "views.paletteCommands.setSortingOrder.pickOrderTitle",
    defaultMessage: "Sort direction",
  },
  pickDialogFooterLabel: {
    id: "views.paletteCommands.setSortingOrder.pickDialogFooterLabel",
    defaultMessage: "Cancel'<Esc>'",
  },
  fieldIssueId: {
    id: "views.paletteCommands.setSortingOrder.fieldIssueId",
    defaultMessage: "Issue ID",
  },
  fieldTitle: {
    id: "views.paletteCommands.setSortingOrder.fieldTitle",
    defaultMessage: "Title",
  },
  fieldStatus: {
    id: "views.paletteCommands.setSortingOrder.fieldStatus",
    defaultMessage: "Status",
  },
  fieldPriority: {
    id: "views.paletteCommands.setSortingOrder.fieldPriority",
    defaultMessage: "Priority",
  },
  fieldCreatedAt: {
    id: "views.paletteCommands.setSortingOrder.fieldCreatedAt",
    defaultMessage: "Creation date",
  },
  fieldLastModified: {
    id: "views.paletteCommands.setSortingOrder.fieldLastModified",
    defaultMessage: "Last updated date",
  },
  orderAsc: {
    id: "views.paletteCommands.setSortingOrder.orderAsc",
    defaultMessage: "Ascending",
  },
  orderDesc: {
    id: "views.paletteCommands.setSortingOrder.orderDesc",
    defaultMessage: "Descending",
  },
  successToast: {
    id: "views.paletteCommands.setSortingOrder.successToast",
    defaultMessage: "Sort order updated",
  },
});

type FieldOption = { field: SortingOrderField; label: string };
type OrderOption = { order: SortingOrder["order"]; label: string };

const FIELD_OPTIONS: FieldOption[] = [
  { field: "id", label: intl.formatMessage(messages.fieldIssueId) },
  { field: "title", label: intl.formatMessage(messages.fieldTitle) },
  { field: "status", label: intl.formatMessage(messages.fieldStatus) },
  { field: "priority", label: intl.formatMessage(messages.fieldPriority) },
  {
    field: "created_at",
    label: intl.formatMessage(messages.fieldCreatedAt),
  },
  {
    field: "updated_at",
    label: intl.formatMessage(messages.fieldLastModified),
  },
];

const ORDER_OPTIONS: OrderOption[] = [
  { order: "asc", label: intl.formatMessage(messages.orderAsc) },
  { order: "desc", label: intl.formatMessage(messages.orderDesc) },
];

function formatPickLabel(label: string, isCurrent: boolean): string {
  return isCurrent ? `(*) ${label}` : label;
}

function indexOfFieldOption(field: SortingOrderField): number {
  const index = FIELD_OPTIONS.findIndex((option) => option.field === field);
  return index >= 0 ? index : 0;
}

function indexOfOrderOption(order: SortingOrder["order"]): number {
  const index = ORDER_OPTIONS.findIndex((option) => option.order === order);
  return index >= 0 ? index : 0;
}

export class SetSortingOrderPaletteCommand implements PaletteCommand {
  readonly label = intl.formatMessage(messages.label);
  readonly key = "setSortingOrder";
  readonly description = intl.formatMessage(messages.description);

  async callback(): Promise<void> {
    const repo = await useCurrentTrackerRepoStore
      .getState()
      .getCurrentTrackerRepo();
    const currentOrder =
      await RegistryService.getInstance().getIssueListSortOrder(
        repo.projectPath,
      );

    const fieldResponse = await usePickItemDialogStore
      .getState()
      .open(
        FIELD_OPTIONS,
        (item) =>
          formatPickLabel(item.label, item.field === currentOrder.field),
        {
          title: intl.formatMessage(messages.pickFieldTitle),
          footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
          initialSelectedIndex: indexOfFieldOption(
            currentOrder.field as SortingOrderField,
          ),
        },
      );

    if (
      fieldResponse.type !== PickItemDialogResponseType.Accepted ||
      fieldResponse.acceptedValue == null
    ) {
      return;
    }

    const selectedField = fieldResponse.acceptedValue.field;

    const orderResponse = await usePickItemDialogStore
      .getState()
      .open(
        ORDER_OPTIONS,
        (item) =>
          formatPickLabel(item.label, item.order === currentOrder.order),
        {
          title: intl.formatMessage(messages.pickOrderTitle),
          footerLabel: intl.formatMessage(messages.pickDialogFooterLabel),
          initialSelectedIndex: indexOfOrderOption(currentOrder.order),
        },
      );

    if (
      orderResponse.type !== PickItemDialogResponseType.Accepted ||
      orderResponse.acceptedValue == null
    ) {
      return;
    }

    const nextOrder: SortingOrder = {
      field: selectedField,
      order: orderResponse.acceptedValue.order,
    };

    await RegistryService.getInstance().setIssueListSortOrder(
      nextOrder,
      repo.projectPath,
    );
    useAppStore.getState().clearTableRangeSelection();
    await useAppStore.getState().refreshIssueLists();

    await useToastStore
      .getState()
      .info(intl.formatMessage(messages.successToast), {
        position: "top-middle",
      });
  }
}

export const setSortingOrderPaletteCommand =
  new SetSortingOrderPaletteCommand();
