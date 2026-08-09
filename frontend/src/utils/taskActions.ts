import { toast } from 'sonner';
import { taskApi, callLogApi } from '../services/api';
import { entityName } from './order';

function taskId(task: any): string {
  return task?._id || task?.id || '';
}

export function orderIdOf(item: { task: any; order?: any }): string {
  return (
    item?.order?.commerceOrderId ||
    item?.task?.sourceOrder?.orderId ||
    item?.task?.orderNumber ||
    item?.task?.orderId ||
    ''
  );
}

export function customerNameOf(order?: any, task?: any): string {
  const c = order?.customer;
  if (typeof c === 'object' && c) return entityName(c.name) || order?.customerPhone || 'Customer';
  return entityName(c) || order?.customerPhone || task?.customerPhone || 'Customer';
}

export function customerPhoneOf(order?: any, task?: any): string {
  const c = order?.customer;
  if (typeof c === 'object' && c && c.phone) return c.phone;
  const raw = order?.customerPhone || order?.customer || task?.customerPhone || '';
  return `${raw}`.replace(/^[^0-9+]+/, '');
}

export async function completeTaskWithOutcome(
  item: { task: any; order?: any },
  label: string,
  outcome?: string
): Promise<boolean> {
  const task = item.task;
  const id = taskId(task);
  const code = outcome || 'other';
  try {
    await taskApi.complete(id, { notes: label, outcome: code, durationMinutes: 0 });
    try {
      await callLogApi.create({
        taskId: id,
        orderId: orderIdOf(item) || undefined,
        outcome: code,
        durationMinutes: 0,
        notes: label,
      });
    } catch {}
    toast.success(`${label} — logged`);
    return true;
  } catch (err: any) {
    toast.error(err?.response?.data?.error?.message || 'Failed to log outcome');
    return false;
  }
}

export async function skipTaskWithNote(task: any, note = 'Skipped from workflow'): Promise<boolean> {
  try {
    await taskApi.skip(taskId(task), { notes: note });
    return true;
  } catch (err: any) {
    toast.error(err?.response?.data?.error?.message || 'Failed to skip task');
    return false;
  }
}

export async function rescheduleTaskTo(task: any, scheduledDate: string): Promise<boolean> {
  try {
    await taskApi.schedule(taskId(task), scheduledDate);
    toast.success('Task rescheduled');
    return true;
  } catch (err: any) {
    toast.error(err?.response?.data?.error?.message || 'Failed to reschedule task');
    return false;
  }
}