import React from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, DollarSign, AlertCircle } from "lucide-react";
import { ExternalInvoice } from "@/types/api";
import StatusPill from "@/components/StatusPill";


type Props = {
  invoice: ExternalInvoice;
  onSetPaid?: () => void;
  onViewDetails?: () => void;
};

const ExternalInvoiceCard: React.FC<Props> = ({ invoice, onSetPaid, onViewDetails }) => {
  const isPaid = invoice.status === "paid";
  const billingMonthStart = new Date(invoice.billingMonth + "T00:00:00");
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const isOverdue = !isPaid && billingMonthStart < currentMonthStart;

  return (
    <Card
      className={`overflow-hidden border-border/60 shadow-none transition-colors ${onViewDetails ? "cursor-pointer hover:border-primary/30 hover:bg-primary/[0.025]" : ""}`}
      onClick={onViewDetails ? () => onViewDetails() : undefined}
    >
      <CardHeader className="border-b border-border/50 bg-muted/15 p-4 pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-primary">
            Invoice #{invoice.id}
          </span>
          <div className="flex items-center gap-2">
            {isOverdue && (
              <Badge variant="destructive" className="text-xs">
                <AlertCircle className="h-3 w-3 mr-1" />
                Overdue
              </Badge>
            )}
            <StatusPill
              label={invoice.status}
              tone={isPaid ? "success" : isOverdue ? "danger" : "warning"}
              dot
              className="capitalize"
            />
          </div>
        </CardTitle>
        <CardDescription className="text-xs">@{invoice.username}</CardDescription>
      </CardHeader>

      <CardContent className="p-4 pb-3">
        <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Customer</span>
            {invoice.fullName}
          </div>
          <div>
            <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Billing month</span>
            {new Date(invoice.billingMonth).toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>
        {invoice.address ? (
          <div title={invoice.address} className="text-xs text-muted-foreground line-clamp-2 mb-2">
            <span className="font-semibold text-foreground">Address:</span> {invoice.address}
          </div>
        ) : null}
        <div className="flex items-center border-t border-border/50 pt-3 text-xl font-semibold tabular-nums">
          <DollarSign className="h-4 w-4 mr-1" />
          {invoice.amount.toFixed(2)}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 border-t border-border/50 bg-muted/10 p-3">
        {onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails();
            }}
          >
            <Eye className="h-4 w-4 mr-1" />
            View details
          </Button>
        )}
        {onSetPaid && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSetPaid();
            }}
            disabled={isPaid}
            className={
              isPaid ? "" : "text-green-600 hover:text-green-700 hover:bg-green-50"
            }
          >
            <Check className="h-4 w-4 mr-1" />
            Set as Paid
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ExternalInvoiceCard;
