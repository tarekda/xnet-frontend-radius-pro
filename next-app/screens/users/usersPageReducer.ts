import { User } from "@/types/api";

export type AdvancedFiltersState = {
  /** Empty string = all account statuses */
  accountStatus: string;
  profile: string;
  quotaExceeded: boolean;
  hasMacAddress: boolean;
  hasContactInfo: boolean;
};

export type ConfirmActionState =
  | null
  | { kind: "delete-user"; username: string }
  | { kind: "reset-mac"; username: string }
  | { kind: "reset-quota"; username: string }
  | { kind: "reset-monthly-quota"; username: string }
  | { kind: "renew-subscription"; username: string }
  | {
      kind: "bulk";
      action: "suspend" | "activate" | "delete" | "reset-mac" | "assign-profile" | "renew";
      usernames: string[];
      profileId?: number;
      profileName?: string;
    };

export type ViewMode = "table" | "cards" | "analytics";

export type UsersPageState = {
  isAddUserModalOpen: boolean;
  editingUser: User | null;
  pageSize: number;
  isRefreshing: boolean;
  statusFilter: string;
  selectedUsers: Set<number>;
  viewMode: ViewMode;
  advancedFilters: AdvancedFiltersState;
  isImportOpen: boolean;
  isExportOpen: boolean;
  confirmAction: ConfirmActionState;
  isBulkActionInProgress: boolean;
};

export type UsersPageAction =
  | { type: "SET_ADD_USER_MODAL_OPEN"; payload: boolean }
  | { type: "SET_EDITING_USER"; payload: User | null }
  | { type: "SET_PAGE_SIZE"; payload: number }
  | { type: "SET_IS_REFRESHING"; payload: boolean }
  | { type: "SET_STATUS_FILTER"; payload: string }
  | { type: "SET_SELECTED_USERS"; payload: Set<number> }
  | { type: "SET_VIEW_MODE"; payload: ViewMode }
  | { type: "SET_ADVANCED_FILTERS"; payload: AdvancedFiltersState }
  | { type: "SET_IMPORT_OPEN"; payload: boolean }
  | { type: "SET_EXPORT_OPEN"; payload: boolean }
  | { type: "SET_CONFIRM_ACTION"; payload: ConfirmActionState }
  | { type: "SET_BULK_ACTION_IN_PROGRESS"; payload: boolean };

export const usersPageInitialState: UsersPageState = {
  isAddUserModalOpen: false,
  editingUser: null,
  pageSize: 50,
  isRefreshing: false,
  statusFilter: "",
  selectedUsers: new Set<number>(),
  viewMode: "table",
  advancedFilters: {
    accountStatus: "",
    profile: "all",
    quotaExceeded: false,
    hasMacAddress: false,
    hasContactInfo: false,
  },
  isImportOpen: false,
  isExportOpen: false,
  confirmAction: null,
  isBulkActionInProgress: false,
};

export function usersPageReducer(state: UsersPageState, action: UsersPageAction): UsersPageState {
  switch (action.type) {
    case "SET_ADD_USER_MODAL_OPEN":
      return { ...state, isAddUserModalOpen: action.payload };
    case "SET_EDITING_USER":
      return { ...state, editingUser: action.payload };
    case "SET_PAGE_SIZE":
      return { ...state, pageSize: action.payload };
    case "SET_IS_REFRESHING":
      return { ...state, isRefreshing: action.payload };
    case "SET_STATUS_FILTER":
      return { ...state, statusFilter: action.payload };
    case "SET_SELECTED_USERS":
      return { ...state, selectedUsers: action.payload };
    case "SET_VIEW_MODE":
      return { ...state, viewMode: action.payload };
    case "SET_ADVANCED_FILTERS":
      return { ...state, advancedFilters: action.payload };
    case "SET_IMPORT_OPEN":
      return { ...state, isImportOpen: action.payload };
    case "SET_EXPORT_OPEN":
      return { ...state, isExportOpen: action.payload };
    case "SET_CONFIRM_ACTION":
      return { ...state, confirmAction: action.payload };
    case "SET_BULK_ACTION_IN_PROGRESS":
      return { ...state, isBulkActionInProgress: action.payload };
    default:
      return state;
  }
}
