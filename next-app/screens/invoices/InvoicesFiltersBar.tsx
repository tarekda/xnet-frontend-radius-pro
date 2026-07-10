import React from 'react';
import { CalendarIcon, Check, Download, PlusCircle, RefreshCw, X } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import IconActionButton from '@/components/IconActionButton';
import SearchBar from '@/components/SearchBar';
import FiltersBar from '@/components/FiltersBar';
import { DateRangePicker } from '@/components/ui/DateRangePicker';

type Props = {
    globalFilter: string;
    onGlobalFilterChange: (term: string) => void;
    onSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    onClearDates: () => void;
    onClearSearch: () => void;
    onBulkSetPaid: () => void;
    bulkDisabled: boolean;
    onRefresh: () => void;
    onGenerateInvoices: () => void;
    isLoading: boolean;
    onExportInvoices: () => void;
    exportDisabled: boolean;
};

/** Search form, date-range filter, and toolbar actions (bulk pay, refresh, generate, export). */
const InvoicesFiltersBar: React.FC<Props> = ({
    globalFilter,
    onGlobalFilterChange,
    onSearchSubmit,
    dateRange,
    onDateRangeChange,
    onClearDates,
    onClearSearch,
    onBulkSetPaid,
    bulkDisabled,
    onRefresh,
    onGenerateInvoices,
    isLoading,
    onExportInvoices,
    exportDisabled,
}) => {
    return (
        <FiltersBar
            left={
                <form
                    onSubmit={onSearchSubmit}
                    className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center"
                >
                    <div className="w-full md:w-72">
                        <SearchBar
                            currentSearchTerm={globalFilter ?? ""}
                            onSearch={onGlobalFilterChange}
                            placeholder="Search invoices..."
                            showButton
                            autoSearch={false}
                        />
                    </div>
                    <DateRangePicker
                        dateRange={dateRange}
                        onDateRangeChange={onDateRangeChange}
                        className="w-full md:w-auto"
                    />
                    <IconActionButton
                        label="Clear dates"
                        onClick={onClearDates}
                        icon={<CalendarIcon className="h-4 w-4" />}
                    />
                    <IconActionButton
                        label="Clear"
                        onClick={onClearSearch}
                        icon={<X className="h-4 w-4" />}
                    />
                </form>
            }
            right={
                <>
                    <IconActionButton
                        label="Set selected as paid"
                        onClick={onBulkSetPaid}
                        disabled={bulkDisabled}
                        icon={<Check className="h-4 w-4" />}
                    />
                    <IconActionButton
                        label="Refresh"
                        onClick={onRefresh}
                        icon={<RefreshCw className="h-4 w-4" />}
                    />
                    <IconActionButton
                        label="Generate invoices"
                        onClick={onGenerateInvoices}
                        disabled={isLoading}
                        icon={<PlusCircle className="h-4 w-4" />}
                    />
                    <IconActionButton
                        label="Export invoices"
                        onClick={onExportInvoices}
                        disabled={exportDisabled}
                        icon={<Download className="h-4 w-4" />}
                    />
                </>
            }
        />
    );
};

export default InvoicesFiltersBar;
