"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { PickupWindow, Day } from "@/types/dashboard";

const DAYS: { value: Day; en: string; hi: string }[] = [
  { value: "MON", en: "Mon", hi: "सोम" },
  { value: "TUE", en: "Tue", hi: "मंगल" },
  { value: "WED", en: "Wed", hi: "बुध" },
  { value: "THU", en: "Thu", hi: "गुरु" },
  { value: "FRI", en: "Fri", hi: "शुक्र" },
  { value: "SAT", en: "Sat", hi: "शनि" },
  { value: "SUN", en: "Sun", hi: "रवि" },
];

interface WindowForm {
  labelEn: string;
  labelHi: string;
  startTime: string;
  endTime: string;
  daysActive: Day[];
}

function DayPills({
  value,
  onChange,
}: {
  value: Day[];
  onChange: (v: Day[]) => void;
}) {
  const { lang } = useLangStore();
  return (
    <div className="flex gap-2 flex-wrap">
      {DAYS.map((d) => {
        const sel = value.includes(d.value);
        return (
          <button
            key={d.value}
            type="button"
            onClick={() =>
              onChange(
                sel ? value.filter((x) => x !== d.value) : [...value, d.value],
              )
            }
            className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-all ${sel ? "bg-kridha-primary text-white" : "bg-gray-100 dark:bg-gray-800 text-muted-DEFAULT dark:text-muted-dark hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 hover:text-kridha-primary"}`}
          >
            {lang === "hi" ? d.hi : d.en}
          </button>
        );
      })}
    </div>
  );
}

function WindowModal({
  open,
  onClose,
  window: win,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  window?: PickupWindow;
  onSave: () => void;
}) {
  const { lang } = useLangStore();
  const isEdit = !!win?.id;
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<WindowForm>({
    defaultValues: win?.id
      ? {
          labelEn: win.labelEn,
          labelHi: win.labelHi,
          startTime: win.startTime,
          endTime: win.endTime,
          daysActive: win.daysActive as Day[],
        }
      : {
          labelEn: "",
          labelHi: "",
          startTime: "09:00",
          endTime: "13:00",
          daysActive: ["MON", "TUE", "WED", "THU", "FRI"] as Day[],
        },
  });
  const [err, setErr] = useState("");

  async function onSubmit(data: WindowForm) {
    setErr("");
    try {
      if (isEdit) await api.patch(`/pickup-windows/${win!.id}`, data);
      else await api.post("/pickup-windows", data);
      onSave();
      onClose();
      reset();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Save failed");
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          reset();
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-md bg-[var(--color-surface)] dark:bg-surface-dark rounded-t-modal sm:rounded-modal shadow-modal z-modal flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-DEFAULT dark:border-border-dark flex-shrink-0">
            <Dialog.Title className="text-h5 font-bold text-[var(--color-text)]">
              {isEdit
                ? lang === "hi"
                  ? "Window Edit करें"
                  : "Edit Window"
                : lang === "hi"
                  ? "Window Add करें"
                  : "Add Window"}
            </Dialog.Title>
            <button
              onClick={() => {
                reset();
                setErr("");
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Label (English) *"
                  {...register("labelEn", { required: true })}
                  error={errors.labelEn ? "Required" : undefined}
                />
                <Input
                  label="Label (Hindi) *"
                  {...register("labelHi", { required: true })}
                  error={errors.labelHi ? "Required" : undefined}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Start Time *"
                  type="time"
                  {...register("startTime", { required: true })}
                  error={errors.startTime ? "Required" : undefined}
                />
                <Input
                  label="End Time *"
                  type="time"
                  {...register("endTime", { required: true })}
                  error={errors.endTime ? "Required" : undefined}
                />
              </div>
              <div>
                <p className="text-label-md font-medium text-[var(--color-text)] mb-2">
                  {lang === "hi" ? "Active Days *" : "Active Days *"}
                </p>
                <Controller
                  name="daysActive"
                  control={control}
                  rules={{
                    validate: (v) => v.length > 0 || "Select at least one day",
                  }}
                  render={({ field }) => (
                    <DayPills value={field.value} onChange={field.onChange} />
                  )}
                />
                {errors.daysActive && (
                  <p className="text-label-xs text-error mt-1">
                    {errors.daysActive.message}
                  </p>
                )}
              </div>
              {err && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error">
                  {err}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border-DEFAULT dark:border-border-dark flex gap-3 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => {
                  reset();
                  setErr("");
                  onClose();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                loading={isSubmitting}
              >
                {isEdit ? "Save Changes" : "Add Window"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteWindowModal({
  open,
  onClose,
  id,
  label,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  id: string;
  label: string;
  onDone: () => void;
}) {
  const { lang } = useLangStore();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function del() {
    setLoading(true);
    setErr("");
    try {
      await api.delete(`/pickup-windows/${id}`);
      onDone();
      onClose();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(
        ex.response?.data?.message ??
          (lang === "hi" ? "Delete नहीं हुआ" : "Delete failed"),
      );
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-error" />
            </div>
            <div>
              <Dialog.Title className="text-label-lg font-bold text-[var(--color-text)]">
                {lang === "hi" ? "Window delete करें?" : "Delete window?"}
              </Dialog.Title>
              <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                {label}
              </p>
            </div>
          </div>
          {err && (
            <div className="mb-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-label-sm text-error">
              {err}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1"
              onClick={() => {
                setErr("");
                onClose();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="lg"
              className="flex-1"
              onClick={del}
              loading={loading}
            >
              {lang === "hi" ? "Delete करें" : "Delete"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function PickupWindowsPage() {
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PickupWindow | null>(null);
  const [deleting, setDeleting] = useState<PickupWindow | null>(null);

  const { data: windows = [], isLoading } = useQuery<PickupWindow[]>({
    queryKey: ["pickup-windows"],
    queryFn: () =>
      api
        .get("/pickup-windows")
        .then((r) => r.data.data?.pickupWindows ?? r.data.data ?? []),
  });
  function inv() {
    qc.invalidateQueries({ queryKey: ["pickup-windows"] });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-h4 font-bold text-[var(--color-text)]">
            {lang === "hi" ? "Pickup Windows" : "Pickup Windows"}
          </h2>
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5">
            {lang === "hi"
              ? `${windows.length} windows — max 7`
              : `${windows.length} windows — max 7`}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-kridha-primary hover:bg-kridha-primary-hover text-white px-4 py-2.5 rounded-btn text-label-md font-semibold transition-colors min-h-touch"
        >
          <Plus className="w-4 h-4" />
          {lang === "hi" ? "Window जोड़ें" : "Add Window"}
        </button>
      </div>

      {isLoading &&
        [...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-20 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse"
          />
        ))}

      {!isLoading && windows.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <Clock className="w-10 h-10 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-md font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "कोई Pickup Window नहीं" : "No pickup windows"}
          </p>
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
            {lang === "hi"
              ? '"Window जोड़ें" से start करें'
              : 'Click "Add Window" to get started'}
          </p>
        </div>
      )}

      {!isLoading &&
        windows.map((w) => (
          <div
            key={w.id}
            className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl px-5 py-4 hover:border-kridha-primary/40 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-label-md text-[var(--color-text)]">
                    {lang === "hi" ? w.labelHi : w.labelEn}
                  </p>
                  <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark">
                    {lang === "hi" ? `(${w.labelEn})` : `(${w.labelHi})`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-2">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  {w.startTime} – {w.endTime}
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(w.daysActive as unknown as string[]).map((d) => {
                    // const day = DAYS.find((x) => x.value === d);
                    return (
                      <span
                        key={d}
                        className="px-2 py-0.5 rounded-md bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary text-[11px] font-semibold"
                      >
                        {/* {day?.(lang === "hi" ? day.hi : day.en) ?? d} */}
                        {d}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setEditing(w)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT hover:border-kridha-primary hover:text-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
                  aria-label="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeleting(w)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg border border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT hover:border-red-400 hover:text-error hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                  aria-label="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

      <WindowModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={inv}
      />
      {editing && (
        <WindowModal
          open={!!editing}
          window={editing}
          onClose={() => setEditing(null)}
          onSave={() => {
            inv();
            setEditing(null);
          }}
        />
      )}
      {deleting && (
        <DeleteWindowModal
          open={!!deleting}
          id={deleting.id}
          label={lang === "hi" ? deleting.labelHi : deleting.labelEn}
          onClose={() => setDeleting(null)}
          onDone={() => {
            inv();
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
