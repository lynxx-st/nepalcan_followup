import { MapPin, Truck, ChevronDown } from 'lucide-react';

const branchLabel = (b: any) => b ? (typeof b === 'string' ? b : `${b.name || ''}${b.code ? ` (${b.code})` : ''}`) : '';
const branchDistrict = (b: any) => (b && typeof b === 'object' && b.district && typeof b.district === 'object' && b.district.name) ? ` · ${b.district.name}` : '';

export default function FulfilmentBreakdown({ order }: { order: any }) {
  const dcb = order.deliveryChargeBreakdown || order.commerce?.deliveryChargeBreakdown || {};
  const originBranch = order.originBranch || order.commerce?.originBranch || null;
  const destinationBranch = order.destinationBranch || order.commerce?.destinationBranch || (order.branch ? { name: order.branch } : null);
  const shippingAmount = order.shippingAmount ?? order.commerce?.shippingAmount ?? 0;
  const chargeRows = [
    { label: 'Customer Delivery Charge', value: dcb.customerDeliveryCharge },
    { label: 'Additional Delivery Charge', value: dcb.additionalDeliveryCharge },
    { label: 'Vendor Drop Charge', value: dcb.vendorDropCharge },
    { label: 'Vendor Pickup Charge', value: dcb.vendorPickupCharge },
    { label: 'Return Charge (Delivered)', value: dcb.returnChargeDelivered },
    { label: 'Return Charge (Not Delivered)', value: dcb.returnChargeNotDelivered },
  ].filter((r) => r.value > 0);

  const hasData = originBranch || destinationBranch || shippingAmount > 0 || chargeRows.length > 0 || dcb.codHandlingFee > 0;
  if (!hasData) return null;

  return (
    <details className="bg-[#fafafa] rounded-2xl border border-[#e5e5e5] group">
      <summary className="flex items-center justify-between gap-2 px-3 py-2.5 cursor-pointer list-none min-h-[44px]">
        <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[#737373]">
          <MapPin className="w-3.5 h-3.5 text-[#dc3545]" />
          Fulfilment & Billing Breakdown
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-[#737373] group-open:rotate-180 transition-transform shrink-0" />
      </summary>
      <div className="px-3 pb-3 space-y-2">
        {(originBranch || destinationBranch) && (
          <div className="flex items-center justify-between gap-2 bg-[#ffffff] border border-[#e5e5e5] rounded-xl p-2.5 text-[11px]">
            <span className="font-semibold text-[#0a0a0a] text-center">
              {branchLabel(originBranch)}
              {originBranch ? branchDistrict(originBranch) : ''}
            </span>
            <Truck className="w-3.5 h-3.5 text-[#0a0a0a] shrink-0" />
            <span className="font-semibold text-[#0a0a0a] text-center">
              {branchLabel(destinationBranch)}
              {destinationBranch ? branchDistrict(destinationBranch) : ''}
            </span>
          </div>
        )}
        <div className="space-y-1 text-[11px] bg-[#ffffff] border border-[#e5e5e5] rounded-xl p-2.5">
          {shippingAmount > 0 && (
            <div className="flex justify-between text-[#737373]">
              <span>Shipping Amount:</span>
              <span className="font-medium text-[#0a0a0a]">Rs. {shippingAmount.toLocaleString()}</span>
            </div>
          )}
          {chargeRows.map((r) => (
            <div key={r.label} className="flex justify-between text-[#737373]">
              <span>{r.label}:</span>
              <span className="font-medium text-[#0a0a0a]">Rs. {r.value.toLocaleString()}</span>
            </div>
          ))}
          {dcb.codHandlingFee > 0 && (
            <div className="flex justify-between text-[#737373]">
              <span>COD Handling Fee:</span>
              <span className="font-medium text-[#0a0a0a]">Rs. {dcb.codHandlingFee.toLocaleString()}</span>
            </div>
          )}
          {(dcb.providerPricing || dcb.deliveryZoneGroup) && (
            <p className="text-[10px] text-[#737373] pt-1 border-t border-[#f5f5f5] break-all">
              providerPricing: {dcb.providerPricing} · deliveryZoneGroup: {dcb.deliveryZoneGroup}
            </p>
          )}
        </div>
      </div>
    </details>
  );
}