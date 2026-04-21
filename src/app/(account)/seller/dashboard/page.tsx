"use client";
// src/app/(seller)/seller/dashboard/page.tsx
// CHANGE: All EditableKV inline-edit replaced by tabbed EditProfileModal (Address/Business/Bank)
// All layout, section order, content, and fields preserved

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Pencil,
  X,
  MapPin,
  Building2,
  CreditCard,
  FileText,
  Star,
  BarChart2,
  Bell,
  Package,
  ShoppingBag,
  ExternalLink,
  Shield,
  AlertCircle,
  CheckCircle2,
  Clock,
  Upload,
  Trash2,
  Loader2,
  UserX,
  Store,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface StoreImage {
  url: string;
  publicId: string;
}
interface SellerProfile {
  storeName: string;
  street: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pinCode: string;
  latitude: number | null;
  longitude: number | null;
  storeImages: StoreImage[];
  businessType: string;
  gstNumber: string | null;
  panNumber: string | null;
  kycStatus: "PENDING" | "VERIFIED" | "REJECTED";
  profileStatus: "PENDING" | "VERIFIED" | "DEACTIVATED";
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  bankVerified: boolean;
  sellerRating: number;
  sellerRatingCount: number;
  reliabilityScore: number;
  user: { name: string };
}

const SC = {
  VERIFIED: {
    l: "Verified",
    cls: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
    dot: "bg-green-500",
  },
  PENDING: {
    l: "Pending",
    cls: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
  },
  DEACTIVATED: {
    l: "Deactivated",
    cls: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
  REJECTED: {
    l: "Rejected",
    cls: "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
} as const;
function StatusBadge({ status }: { status: keyof typeof SC }) {
  const c = SC[status] ?? SC.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${c.cls}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.l}
    </span>
  );
}
function Section({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-DEFAULT dark:border-border-dark bg-gray-50/50 dark:bg-gray-800/20">
        <div className="flex items-center gap-2">
          <span className="text-kridha-primary">{icon}</span>
          <h3 className="text-label-md font-semibold text-[var(--color-text)]">
            {title}
          </h3>
        </div>
        {action}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
function KV({
  label,
  value,
  masked,
  mono,
}: {
  label: string;
  value?: string | null;
  masked?: boolean;
  mono?: boolean;
}) {
  const d =
    masked && value
      ? `${"•".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`
      : (value ?? "—");
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0 gap-4">
      <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 min-w-[120px]">
        {label}
      </span>
      <span
        className={`text-label-sm text-right break-all ${mono ? "font-mono text-blue-600 dark:text-blue-400" : "text-[var(--color-text)] font-medium"}`}
      >
        {d}
      </span>
    </div>
  );
}
function StatCard({
  icon,
  label,
  value,
  sub,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-4 hover:border-kridha-primary/40 transition-colors h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary">
          {icon}
        </div>
        {href && (
          <ExternalLink className="w-3.5 h-3.5 text-muted-DEFAULT dark:text-muted-dark" />
        )}
      </div>
      <p className="text-h4 font-bold text-[var(--color-text)] leading-none">
        {value}
      </p>
      <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-1">
        {label}
      </p>
      {sub && <p className="text-label-xs text-kridha-primary mt-0.5">{sub}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
  );
}

async function signedUpload(file: File): Promise<StoreImage> {
  const { data: s } = await api.post<{
    success: true;
    data: {
      signature: string;
      timestamp: number;
      cloudName: string;
      apiKey: string;
      folder: string;
    };
  }>("/upload/sign", { folder: "stores" });
  const { signature, timestamp, cloudName, apiKey, folder } = s.data;
  const form = new FormData();
  form.append("file", file);
  form.append("signature", signature);
  form.append("timestamp", String(timestamp));
  form.append("api_key", apiKey);
  form.append("folder", folder);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error("Upload failed");
  const d = (await res.json()) as { secure_url: string; public_id: string };
  return { url: d.secure_url, publicId: d.public_id };
}
function StoreImageManager({
  images,
  onUpdate,
}: {
  images: StoreImage[];
  onUpdate: () => void;
}) {
  const { lang } = useLangStore();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (images.length + files.length > 5) {
      setErr("Max 5");
      return;
    }
    setUploading(true);
    setErr(null);
    try {
      const u = await Promise.all(files.map(signedUpload));
      await api.post("/sellers/profile/images", { images: u });
      onUpdate();
    } catch {
      setErr("Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  async function del(publicId: string) {
    setDeleting(publicId);
    try {
      await api.delete(
        `/sellers/profile/images/${encodeURIComponent(publicId)}`,
      );
      onUpdate();
    } catch {
    } finally {
      setDeleting(null);
    }
  }
  return (
    <div>
      {images.length > 0 && (
        <div className="flex gap-3 flex-wrap mb-4">
          {images.map((img, i) => (
            <div
              key={img.publicId ?? i}
              className="relative group w-28 h-20 rounded-xl overflow-hidden border border-border-DEFAULT dark:border-border-dark"
            >
              <Image
                src={img.url}
                alt={`Store ${i + 1}`}
                fill
                className="object-cover"
              />
              <button
                onClick={() => del(img.publicId)}
                disabled={deleting === img.publicId}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                {deleting === img.publicId ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 text-white" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < 5 && (
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={handleFiles}
            disabled={uploading}
          />
          <div
            className={`inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl text-label-sm transition-colors ${uploading ? "border-kridha-primary/40 text-kridha-primary" : "border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary text-muted-DEFAULT dark:text-muted-dark"}`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {lang === "hi" ? "Uploading..." : "Uploading..."}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                {lang === "hi" ? "Upload करें" : "Upload images"}
              </>
            )}
          </div>
        </label>
      )}
      {images.length === 0 && !uploading && (
        <div className="flex flex-col items-center py-8 gap-2 text-center">
          <Building2 className="w-8 h-8 text-muted-DEFAULT dark:text-muted-dark" />
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
            No store images yet
          </p>
        </div>
      )}
      {err && <p className="text-label-xs text-error mt-2">{err}</p>}
    </div>
  );
}

// ── EDIT PROFILE MODAL ── tabbed: Address | Business | Bank ──────────────────
type EditTab = "address" | "business" | "bank";
interface EditForm {
  storeName: string;
  street: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  businessType: string;
  gstNo: string;
  panNo: string;
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}
function EditProfileModal({
  open,
  onClose,
  profile,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  profile: SellerProfile;
  onSave: () => void;
}) {
  const { lang } = useLangStore();
  const [tab, setTab] = useState<EditTab>("address");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditForm>({
    defaultValues: {
      storeName: profile.storeName,
      street: profile.street,
      line2: profile.line2 ?? "",
      landmark: profile.landmark ?? "",
      city: profile.city,
      state: profile.state,
      pincode: profile.pinCode,
      businessType: profile.businessType,
      gstNo: profile.gstNumber ?? "",
      panNo: profile.panNumber ?? "",
      accountHolderName: profile.accountHolderName ?? "",
      accountNumber: "",
      ifscCode: profile.ifscCode ?? "",
      bankName: profile.bankName ?? "",
    },
  });
  async function onSubmit(data: EditForm) {
    setSaving(true);
    setErr("");
    try {
      const p: Record<string, string> = {};
      if (tab === "address") {
        p.storeName = data.storeName;
        p.street = data.street;
        if (data.line2) p.line2 = data.line2;
        if (data.landmark) p.landmark = data.landmark;
        p.city = data.city;
        p.state = data.state;
        p.pincode = data.pincode;
      }
      if (tab === "business") {
        p.businessType = data.businessType;
        if (data.gstNo) p.gstNo = data.gstNo;
        if (data.panNo) p.panNo = data.panNo;
      }
      if (tab === "bank") {
        if (data.accountHolderName)
          p.accountHolderName = data.accountHolderName;
        if (data.accountNumber) p.accountNumber = data.accountNumber;
        if (data.ifscCode) p.ifscCode = data.ifscCode;
        if (data.bankName) p.bankName = data.bankName;
      }
      await api.patch("/sellers/profile", p);
      onSave();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }
  const TABS: { k: EditTab; en: string; hi: string }[] = [
    { k: "address", en: "Address", hi: "Address" },
    { k: "business", en: "Business", hi: "Business" },
    { k: "bank", en: "Bank", hi: "Bank" },
  ];
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) {
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-lg bg-[var(--color-surface)] dark:bg-surface-dark sm:rounded-modal shadow-modal z-modal flex flex-col max-h-screen sm:max-h-[85vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-DEFAULT dark:border-border-dark flex-shrink-0">
            <Dialog.Title className="text-h5 font-bold text-[var(--color-text)]">
              {lang === "hi" ? "Profile Edit करें" : "Edit Profile"}
            </Dialog.Title>
            <button
              onClick={() => {
                if (!saving) {
                  setErr("");
                  onClose();
                }
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex border-b border-border-DEFAULT dark:border-border-dark flex-shrink-0">
            {TABS.map((t) => (
              <button
                key={t.k}
                type="button"
                onClick={() => setTab(t.k)}
                className={`flex-1 py-3 text-label-sm font-semibold border-b-2 transition-colors ${tab === t.k ? "border-kridha-primary text-kridha-primary" : "border-transparent text-muted-DEFAULT dark:text-muted-dark"}`}
              >
                {lang === "hi" ? t.hi : t.en}
              </button>
            ))}
          </div>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {tab === "address" && (
                <>
                  <Input
                    label="Store Name *"
                    {...register("storeName", { required: true })}
                    error={errors.storeName ? "Required" : undefined}
                  />
                  <Input
                    label="Street *"
                    {...register("street", { required: true })}
                    error={errors.street ? "Required" : undefined}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Line 2" {...register("line2")} />
                    <Input label="Landmark" {...register("landmark")} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="City *"
                      {...register("city", { required: true })}
                      error={errors.city ? "Required" : undefined}
                    />
                    <Input
                      label="State *"
                      {...register("state", { required: true })}
                      error={errors.state ? "Required" : undefined}
                    />
                  </div>
                  <Input
                    label="PIN Code *"
                    {...register("pincode", {
                      required: true,
                      pattern: /^\d{6}$/,
                    })}
                    error={errors.pincode ? "6-digit PIN required" : undefined}
                  />
                </>
              )}
              {tab === "business" && (
                <>
                  <div>
                    <label className="block text-label-md text-muted-DEFAULT dark:text-muted-dark mb-1.5">
                      Business Type
                    </label>
                    <select
                      {...register("businessType")}
                      className="w-full px-4 py-3 rounded-xl border border-border-DEFAULT dark:border-border-dark bg-[var(--color-surface)] dark:bg-surface-dark text-[var(--color-text)] text-label-sm outline-none focus:border-kridha-primary focus:ring-2 focus:ring-kridha-primary/20"
                    >
                      <option value="INDIVIDUAL">Individual</option>
                      <option value="PROPRIETORSHIP">Proprietorship</option>
                      <option value="PARTNERSHIP">Partnership</option>
                      <option value="PVT_LTD">Pvt Ltd</option>
                    </select>
                  </div>
                  <Input label="GST Number" {...register("gstNo")} />
                  <Input label="PAN Number" {...register("panNo")} />
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-label-xs text-amber-700 dark:text-amber-400">
                      Changing KYC details resets verification to Pending.
                    </p>
                  </div>
                </>
              )}
              {tab === "bank" && (
                <>
                  <Input
                    label="Account Holder Name"
                    {...register("accountHolderName")}
                  />
                  <Input
                    label="New Account Number"
                    type="password"
                    placeholder={
                      lang === "hi"
                        ? "खाली = unchanged"
                        : "Leave blank to keep current"
                    }
                    {...register("accountNumber")}
                  />
                  <Input label="IFSC Code" {...register("ifscCode")} />
                  <Input label="Bank Name" {...register("bankName")} />
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <Shield className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-label-xs text-amber-700 dark:text-amber-400">
                      Bank changes reset bankVerified. Admin re-verifies before
                      next payout.
                    </p>
                  </div>
                </>
              )}
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
                  if (!saving) {
                    setErr("");
                    onClose();
                  }
                }}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="flex-1"
                loading={saving}
              >
                Save Changes
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteSellerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang } = useLangStore();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function handle() {
    if (pin.length !== 4) return;
    setLoading(true);
    setErr("");
    try {
      await api.delete("/sellers/profile", { data: { pin } });
      window.location.href = "/";
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Failed");
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setPin("");
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
              <Store className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <button
              onClick={() => {
                if (!loading) {
                  setPin("");
                  setErr("");
                  onClose();
                }
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Dialog.Title className="text-h5 font-bold text-[var(--color-text)] mb-1">
            {lang === "hi"
              ? "Seller Profile delete करें?"
              : "Delete Seller Profile?"}
          </Dialog.Title>
          <Dialog.Description className="text-body-sm text-muted-DEFAULT dark:text-muted-dark mb-5">
            {lang === "hi"
              ? "Store हटेगा, buyer account safe रहेगा।"
              : "Store removed. Buyer account stays active."}
          </Dialog.Description>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full px-3 py-2.5 border border-border-DEFAULT dark:border-border-dark rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 font-mono tracking-widest mb-4"
          />
          {err && (
            <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-label-sm text-amber-700 dark:text-amber-400">
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
                if (!loading) {
                  setPin("");
                  setErr("");
                  onClose();
                }
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="lg"
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white border-0"
              onClick={handle}
              loading={loading}
              disabled={pin.length !== 4 || loading}
            >
              Delete Profile
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function DeleteAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang } = useLangStore();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  async function handle() {
    if (pin.length !== 4) return;
    setLoading(true);
    setErr("");
    try {
      await api.delete("/users/me", { data: { pin } });
      window.location.href = "/";
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Failed");
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setPin("");
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-error" />
            </div>
            <button
              onClick={() => {
                if (!loading) {
                  setPin("");
                  setErr("");
                  onClose();
                }
              }}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Dialog.Title className="text-h5 font-bold text-[var(--color-text)] mb-1">
            {lang === "hi"
              ? "Account delete करें?"
              : "Delete account permanently?"}
          </Dialog.Title>
          <Dialog.Description className="text-body-sm text-muted-DEFAULT dark:text-muted-dark mb-5">
            {lang === "hi"
              ? "Permanent — undo नहीं होगा।"
              : "Permanent and irreversible."}
          </Dialog.Description>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Enter PIN"
            className="w-full px-3 py-2.5 border border-border-DEFAULT dark:border-border-dark rounded-lg bg-[var(--color-surface)] text-[var(--color-text)] text-body-sm outline-none focus:border-error focus:ring-2 focus:ring-error/20 font-mono tracking-widest mb-4"
          />
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
                if (!loading) {
                  setPin("");
                  setErr("");
                  onClose();
                }
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
              onClick={handle}
              loading={loading}
              disabled={pin.length !== 4 || loading}
            >
              Delete Account
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function SellerDashboardPage() {
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [delProfileOpen, setDelProfileOpen] = useState(false);
  const [delAccountOpen, setDelAccountOpen] = useState(false);
  const { data: profile, isLoading: pLoad } = useQuery<SellerProfile>({
    queryKey: ["seller-profile-dashboard"],
    queryFn: () => api.get("/sellers/profile").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
  const { data: notifs } = useQuery<{
    notifications: {
      id: string;
      title: string;
      body: string;
      read: boolean;
      createdAt: string;
    }[];
    unreadCount: number;
  }>({
    queryKey: ["notifications-dash"],
    queryFn: () => api.get("/notifications?limit=5").then((r) => r.data.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const { data: orders } = useQuery<{ id: string }[]>({
    queryKey: ["orders-recent"],
    queryFn: () => api.get("/orders?limit=5").then((r) => r.data.data),
    staleTime: 30_000,
  });
  const { data: prodStats } = useQuery<{ total: number }>({
    queryKey: ["product-stats"],
    queryFn: () =>
      api
        .get("/products/mine?limit=1")
        .then((r) => ({ total: r.data.meta?.total ?? 0 })),
    staleTime: 60_000,
  });
  function inv() {
    qc.invalidateQueries({ queryKey: ["seller-profile-dashboard"] });
    qc.invalidateQueries({ queryKey: ["seller-profile-sidebar"] });
  }
  const avatar = profile?.storeImages?.[0]?.url;
  const isV = profile?.profileStatus === "VERIFIED";
  const mapUrl =
    profile?.latitude && profile?.longitude
      ? `https://maps.google.com/?q=${profile.latitude},${profile.longitude}`
      : null;
  const editBtn = (
    <button
      onClick={() => setEditOpen(true)}
      className="flex items-center gap-1 text-label-xs text-kridha-primary hover:underline"
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );
  if (pLoad)
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className={`rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse ${i === 0 ? "h-48" : i < 2 ? "h-24" : "h-40"}`}
          />
        ))}
      </div>
    );
  if (!profile) return null;
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
        <div className="relative h-24 w-full rounded-2xl overflow-hidden">
          {avatar ? (
            <Image
              src={avatar}
              alt={profile.storeName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-r from-kridha-primary/20 via-kridha-secondary dark:via-kridha-primary/10 to-transparent" />
          )}
        </div>
        <div className="px-5 pb-5 -mt-10 flex items-end justify-between gap-4 flex-wrap">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl border-4 border-[var(--color-surface)] dark:border-surface-dark overflow-hidden bg-kridha-secondary dark:bg-kridha-primary/10">
                <div className="w-full h-full flex items-center justify-center text-kridha-primary font-bold text-2xl">
                  {profile.storeName.charAt(0)}
                </div>
            </div>
            {isV && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-[var(--color-surface)] flex items-center justify-center">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-10">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-h4 font-bold text-[var(--color-text)] truncate">
                {profile.storeName}
              </h1>
              <StatusBadge status={profile.profileStatus} />
            </div>
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {profile.city}, {profile.state}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-kridha-primary text-kridha-primary text-label-sm font-semibold hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
              {lang === "hi" ? "Edit" : "Edit"}
            </button>
            <Link
              href="/seller/notifications"
              className="relative p-2.5 rounded-xl border border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
            >
              <Bell className="w-5 h-5 text-[var(--color-text)]" />
              {(notifs?.unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-kridha-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {(notifs?.unreadCount ?? 0) > 9 ? "9+" : notifs?.unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Star className="w-4 h-4" />}
          label="Rating"
          value={
            profile.sellerRating > 0 ? profile.sellerRating.toFixed(1) : "—"
          }
          sub={
            profile.sellerRatingCount > 0
              ? `${profile.sellerRatingCount} reviews`
              : undefined
          }
          href="/seller/reviews"
        />
        <StatCard
          icon={<BarChart2 className="w-4 h-4" />}
          label="Reliability"
          value={`${profile.reliabilityScore}%`}
        />
        <StatCard
          icon={<ShoppingBag className="w-4 h-4" />}
          label="Products"
          value={prodStats?.total ?? "—"}
          href="/seller/products"
        />
        <StatCard
          icon={<Package className="w-4 h-4" />}
          label="Orders"
          value={orders?.length ?? "—"}
          href="/seller/orders"
        />
      </div>
      {/* Reliability bar */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-label-sm font-semibold text-[var(--color-text)]">
            Reliability Score
          </p>
          <p className="text-label-sm font-bold text-kridha-primary">
            {profile.reliabilityScore}%
          </p>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${profile.reliabilityScore}%`,
              background:
                profile.reliabilityScore >= 80
                  ? "var(--color-kridha-primary)"
                  : profile.reliabilityScore >= 50
                    ? "#D97706"
                    : "#DC2626",
            }}
          />
        </div>
        <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-1.5">
          {profile.reliabilityScore >= 80
            ? "Excellent — buyers trust you"
            : profile.reliabilityScore >= 50
              ? "Good — keep improving"
              : "Needs attention"}
        </p>
      </div>
      {/* Notifications */}
      {(notifs?.notifications?.length ?? 0) > 0 && (
        <Section
          icon={<Bell className="w-4 h-4" />}
          title="Notifications"
          action={
            <Link
              href="/seller/notifications"
              className="text-label-xs text-kridha-primary hover:underline"
            >
              {lang === "hi" ? "सभी देखें" : "See all"}
            </Link>
          }
        >
          <div className="space-y-2">
            {notifs!.notifications.slice(0, 4).map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 p-3 rounded-xl ${!n.read ? "bg-kridha-secondary dark:bg-kridha-primary/10" : "bg-gray-50 dark:bg-gray-800/30"}`}
              >
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${!n.read ? "bg-kridha-primary" : "bg-transparent"}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-label-sm font-semibold text-[var(--color-text)] truncate">
                    {n.title}
                  </p>
                  <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark truncate">
                    {n.body}
                  </p>
                </div>
                <span className="text-label-xs text-muted-DEFAULT dark:text-muted-dark flex-shrink-0">
                  {new Date(n.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {/* Store images */}
      <Section
        icon={<Building2 className="w-4 h-4" />}
        title={lang === "hi" ? "Store Images" : "Store Images"}
      >
        <StoreImageManager images={profile.storeImages} onUpdate={inv} />
      </Section>
      {/* Address */}
      <Section
        icon={<MapPin className="w-4 h-4" />}
        title="Address"
        action={editBtn}
      >
        <KV label="Store Name" value={profile.storeName} />
        <KV label="Street" value={profile.street} />
        <KV label="Line 2" value={profile.line2} />
        <KV label="Landmark" value={profile.landmark} />
        <KV label="City" value={profile.city} />
        <KV label="State" value={profile.state} />
        <KV label="PIN Code" value={profile.pinCode} />
        {mapUrl ? (
          <div className="pt-3">
            <Link
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 text-kridha-primary text-label-sm font-medium hover:bg-kridha-primary hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View on Maps
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3 text-muted-DEFAULT dark:text-muted-dark">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="text-label-xs">Location not set</p>
          </div>
        )}
      </Section>
      {/* Business */}
      <Section
        icon={<Building2 className="w-4 h-4" />}
        title="Business Details"
        action={editBtn}
      >
        <KV label="Business Type" value={profile.businessType} />
        <KV label="GST Number" value={profile.gstNumber} />
        <KV label="PAN Number" value={profile.panNumber} />
        <div className="flex items-start justify-between py-2.5 gap-4">
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark min-w-[120px]">
            KYC Status
          </span>
          <StatusBadge status={profile.kycStatus} />
        </div>
        <div className="flex items-start justify-between py-2.5 gap-4">
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark min-w-[120px]">
            Profile Status
          </span>
          <StatusBadge status={profile.profileStatus} />
        </div>
        {profile.profileStatus !== "VERIFIED" && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-label-xs text-amber-700 dark:text-amber-400">
              Pending verification — admin will review within 12-48 hours.
            </p>
          </div>
        )}
      </Section>
      {/* Bank */}
      <Section
        icon={<CreditCard className="w-4 h-4" />}
        title="Bank Details"
        action={
          <div className="flex items-center gap-2">
            {profile.bankVerified ? (
              <span className="inline-flex items-center gap-1 text-label-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-label-xs text-amber-600 dark:text-amber-400">
                <Clock className="w-3 h-3" />
                Pending
              </span>
            )}
            {editBtn}
          </div>
        }
      >
        <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-label-xs text-amber-700 dark:text-amber-400">
            Bank details masked. Changes require re-verification.
          </p>
        </div>
        <KV label="Account Holder" value={profile.accountHolderName} />
        <KV label="Account No." value={profile.accountNumber} masked />
        <KV label="IFSC Code" value={profile.ifscCode} mono />
        <KV label="Bank Name" value={profile.bankName} />
      </Section>
      {/* Metrics */}
      <Section icon={<Star className="w-4 h-4" />} title="Seller Metrics">
        <KV
          label="Rating"
          value={
            profile.sellerRating > 0
              ? `${profile.sellerRating.toFixed(1)} / 5`
              : "No ratings yet"
          }
        />
        <KV label="Total Reviews" value={String(profile.sellerRatingCount)} />
        <KV label="Reliability" value={`${profile.reliabilityScore}%`} />
        <div className="pt-3">
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-kridha-primary"
              style={{ width: `${(profile.sellerRating / 5) * 100}%` }}
            />
          </div>
        </div>
      </Section>
      {/* Quick Links */}
      <Section icon={<Package className="w-4 h-4" />} title="Quick Links">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              href: "/seller/products",
              label: "My Products",
              icon: <ShoppingBag className="w-4 h-4" />,
            },
            {
              href: "/seller/orders",
              label: "Orders",
              icon: <Package className="w-4 h-4" />,
            },
            {
              href: "/seller/pickup-windows",
              label: "Pickup Windows",
              icon: <Clock className="w-4 h-4" />,
            },
            {
              href: "/seller/deals",
              label: "Deals",
              icon: <FileText className="w-4 h-4" />,
            },
            {
              href: "/seller/reviews",
              label: "Reviews",
              icon: <Star className="w-4 h-4" />,
            },
            {
              href: "/seller/payouts",
              label: "Payouts",
              icon: <CreditCard className="w-4 h-4" />,
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all text-label-sm font-medium text-[var(--color-text)] group"
            >
              <span className="text-muted-DEFAULT group-hover:text-kridha-primary transition-colors">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      </Section>
      {/* Danger Zone */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-red-200 dark:border-red-900 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10">
          <h3 className="text-label-md font-semibold text-error">
            Danger Zone
          </h3>
        </div>
        <div className="px-5 py-5 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-label-md font-semibold text-[var(--color-text)]">
                Delete Seller Profile
              </p>
              <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                Removes store. Buyer account stays active.
              </p>
            </div>
            <button
              onClick={() => setDelProfileOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-label-sm font-medium hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors flex-shrink-0"
            >
              <Store className="w-4 h-4" />
              Delete Profile
            </button>
          </div>
          <div className="border-t border-red-100 dark:border-red-900 pt-3 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-label-md font-semibold text-error">
                Delete Account
              </p>
              <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
                Permanent and irreversible.
              </p>
            </div>
            <button
              onClick={() => setDelAccountOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-error text-label-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
            >
              <UserX className="w-4 h-4" />
              Delete Account
            </button>
          </div>
        </div>
      </div>
      {profile && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          onSave={() => {
            inv();
            setEditOpen(false);
          }}
        />
      )}
      <DeleteSellerModal
        open={delProfileOpen}
        onClose={() => setDelProfileOpen(false)}
      />
      <DeleteAccountModal
        open={delAccountOpen}
        onClose={() => setDelAccountOpen(false)}
      />
    </div>
  );
}
