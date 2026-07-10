import type { RowSelectionState, Updater } from "@tanstack/react-table";
import type { DateRange } from "react-day-picker";

export type ExternalInvoicesPageState = {
  searchTerm: string;
  searchInput: string;
  refreshKey: number;
  rowSelection: RowSelectionState;
  pageSize: number;
  currentPage: number;
  isConfirmBulkPaidOpen: boolean;
  isConfirmBulkDeleteOpen: boolean;
  isExportingAll: boolean;
  isBulkPaidInProgress: boolean;
  isDateFilterOpen: boolean;
  draftDateRange: DateRange | undefined;
};

export type ExternalInvoicesPageAction =
  | { type: "SET_SEARCH_TERM"; payload: string }
  | { type: "SET_SEARCH_INPUT"; payload: string }
  | { type: "INCREMENT_REFRESH_KEY" }
  | { type: "UPDATE_ROW_SELECTION"; payload: Updater<RowSelectionState> }
  | { type: "SET_PAGE_SIZE"; payload: number }
  | { type: "SET_CURRENT_PAGE"; payload: number }
  | { type: "SET_CONFIRM_BULK_PAID_OPEN"; payload: boolean }
  | { type: "SET_CONFIRM_BULK_DELETE_OPEN"; payload: boolean }
  | { type: "SET_EXPORTING_ALL"; payload: boolean }
  | { type: "SET_BULK_PAID_IN_PROGRESS"; payload: boolean }
  | { type: "SET_DATE_FILTER_OPEN"; payload: boolean }
  | { type: "SET_DRAFT_DATE_RANGE"; payload: DateRange | undefined };

export const createExternalInvoicesPageInitialState = (defaultPageSize: number): ExternalInvoicesPageState => ({
  searchTerm: "",
  searchInput: "",
  refreshKey: 0,
  rowSelection: {},
  pageSize: defaultPageSize,
  currentPage: 1,
  isConfirmBulkPaidOpen: false,
  isConfirmBulkDeleteOpen: false,
  isExportingAll: false,
  isBulkPaidInProgress: false,
  isDateFilterOpen: false,
  draftDateRange: undefined,
});

export function externalInvoicesPageReducer(
  state: ExternalInvoicesPageState,
  action: ExternalInvoicesPageAction
): ExternalInvoicesPageState {
  switch (action.type) {
    case "SET_SEARCH_TERM":
      return { ...state, searchTerm: action.payload };
    case "SET_SEARCH_INPUT":
      return { ...state, searchInput: action.payload };
    case "INCREMENT_REFRESH_KEY":
      return { ...state, refreshKey: state.refreshKey + 1 };
    case "UPDATE_ROW_SELECTION":
      return {
        ...state,
        rowSelection:
          typeof action.payload === "function"
            ? action.payload(state.rowSelection)
            : action.payload,
      };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.payload };
    case "SET_CURRENT_PAGE":
      return { ...state, currentPage: action.payload };
    case "SET_CONFIRM_BULK_PAID_OPEN":
      return { ...state, isConfirmBulkPaidOpen: action.payload };
    case "SET_CONFIRM_BULK_DELETE_OPEN":
      return { ...state, isConfirmBulkDeleteOpen: action.payload };
    case "SET_EXPORTING_ALL":
      return { ...state, isExportingAll: action.payload };
    case "SET_BULK_PAID_IN_PROGRESS":
      return { ...state, isBulkPaidInProgress: action.payload };
    case "SET_DATE_FILTER_OPEN":
      return { ...state, isDateFilterOpen: action.payload };
    case "SET_DRAFT_DATE_RANGE":
      return { ...state, draftDateRange: action.payload };
    default:
      return state;
  }
}
