import { useCallback, useReducer } from "react";
import type { DateRange } from "react-day-picker";
import type { RowSelectionState, Updater } from "@tanstack/react-table";
import {
  createExternalInvoicesPageInitialState,
  externalInvoicesPageReducer,
} from "./externalInvoicesPageReducer";

export function useExternalInvoicesPageState(defaultPageSize: number) {
  const [pageState, dispatch] = useReducer(
    externalInvoicesPageReducer,
    createExternalInvoicesPageInitialState(defaultPageSize)
  );

  const setSearchTerm = useCallback((value: string) => dispatch({ type: "SET_SEARCH_TERM", payload: value }), []);
  const setSearchInput = useCallback((value: string) => dispatch({ type: "SET_SEARCH_INPUT", payload: value }), []);
  const setPageSize = useCallback((value: number) => dispatch({ type: "SET_PAGE_SIZE", payload: value }), []);
  const setCurrentPage = useCallback((value: number) => dispatch({ type: "SET_CURRENT_PAGE", payload: value }), []);
  const setIsConfirmBulkPaidOpen = useCallback((value: boolean) => dispatch({ type: "SET_CONFIRM_BULK_PAID_OPEN", payload: value }), []);
  const setIsConfirmBulkDeleteOpen = useCallback((value: boolean) => dispatch({ type: "SET_CONFIRM_BULK_DELETE_OPEN", payload: value }), []);
  const setIsExportingAll = useCallback((value: boolean) => dispatch({ type: "SET_EXPORTING_ALL", payload: value }), []);
  const setIsBulkPaidInProgress = useCallback((value: boolean) => dispatch({ type: "SET_BULK_PAID_IN_PROGRESS", payload: value }), []);
  const setIsDateFilterOpen = useCallback((value: boolean) => dispatch({ type: "SET_DATE_FILTER_OPEN", payload: value }), []);
  const setDraftDateRange = useCallback((value: DateRange | undefined) => dispatch({ type: "SET_DRAFT_DATE_RANGE", payload: value }), []);
  const incrementRefreshKey = useCallback(() => dispatch({ type: "INCREMENT_REFRESH_KEY" }), []);
  const setRowSelection = useCallback((updater: Updater<RowSelectionState>) => {
    dispatch({ type: "UPDATE_ROW_SELECTION", payload: updater });
  }, []);

  return {
    ...pageState,
    setSearchTerm,
    setSearchInput,
    setPageSize,
    setCurrentPage,
    setIsConfirmBulkPaidOpen,
    setIsConfirmBulkDeleteOpen,
    setIsExportingAll,
    setIsBulkPaidInProgress,
    setIsDateFilterOpen,
    setDraftDateRange,
    incrementRefreshKey,
    setRowSelection,
  };
}
