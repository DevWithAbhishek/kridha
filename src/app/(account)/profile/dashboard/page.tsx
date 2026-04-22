"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Pencil,
  X,
  MapPin,
  Package,
  Heart,
  Bell,
  AlertCircle,
  ShoppingCart,
  BookmarkIcon,
  Star,
  Upload,
  Trash2,
  UserX,
  Languages,
} from "lucide-react";
import { api } from "@/lib/api";
import { useLangStore } from "@/stores/langStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { User } from "@/types/dashboard";

// ── Primitives ────────────────────────────────────────────────────────────────
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
  mono,
  masked,
}: {
  label: string;
  value?: string | null | number;
  mono?: boolean;
  masked?: boolean;
}) {
  const d =
    masked && typeof value === "string"
      ? `+91 XXXXX X${String(value).slice(-4)}`
      : (value ?? "—");
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-0 gap-4">
      <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark flex-shrink-0 min-w-[120px]">
        {label}
      </span>
      <span
        className={`text-label-sm text-right break-all ${mono ? "font-mono text-blue-600 dark:text-blue-400" : "text-[var(--color-text)] font-medium"}`}
      >
        {String(d)}
      </span>
    </div>
  );
}
function StatCard({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  href?: string;
}) {
  const inner = (
    <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl p-4 hover:border-kridha-primary/40 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-kridha-secondary dark:bg-kridha-primary/10 flex items-center justify-center text-kridha-primary mb-3">
        {icon}
      </div>
      <p className="text-h4 font-bold text-[var(--color-text)] leading-none">
        {value}
      </p>
      <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mt-1">
        {label}
      </p>
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

// ── Cloudinary avatar upload ───────────────────────────────────────────────────
async function uploadAvatar(
  file: File,
): Promise<{ url: string; publicId: string }> {
  const { data: s } = await api.post<{
    success: true;
    data: {
      signature: string;
      timestamp: number;
      cloudName: string;
      apiKey: string;
      folder: string;
    };
  }>("/upload/sign", { folder: "profiles" });
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

// ── Edit Avatar Modal ─────────────────────────────────────────────────────────
function EditAvatarModal({
  open,
  onClose,
  currentUrl,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currentUrl?: string | null;
  onSave: () => void;
}) {
  const { lang } = useLangStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  function handleFile(f: File) {
    if (f.size > 5 * 1024 * 1024) {
      setErr("5MB से बड़ी file नहीं");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }
  async function save() {
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      const { url, publicId } = await uploadAvatar(file);
      await api.post("/users/me/avatar", {
        profileImageUrl: url,
        profileImagePublicId: publicId,
      });
      onSave();
      onClose();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  async function removeAvatar() {
    setUploading(true);
    try {
      await api.delete("/users/me/avatar");
      onSave();
      onClose();
    } catch {
    } finally {
      setUploading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !uploading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6 text-center">
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="text-h5 font-bold text-[var(--color-text)]">
              {lang === "hi" ? "Photo Edit करें" : "Edit Photo"}
            </Dialog.Title>
            <button
              onClick={() => {
                if (!uploading) onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative w-24 h-24 rounded-full overflow-hidden bg-kridha-secondary dark:bg-kridha-primary/10 mx-auto mb-5 border-4 border-border-DEFAULT dark:border-border-dark">
            {preview ? (
              <Image src={preview} alt="Avatar" fill className="object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-kridha-primary font-bold text-3xl">
                ?
              </span>
            )}
          </div>
          <label className="cursor-pointer block mb-3">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <div className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-border-DEFAULT dark:border-border-dark rounded-xl text-label-sm text-muted-DEFAULT dark:text-muted-dark hover:border-kridha-primary hover:text-kridha-primary transition-colors">
              <Upload className="w-4 h-4" />
              {lang === "hi" ? "Photo चुनें" : "Choose photo"}
            </div>
          </label>
          {err && <p className="text-label-xs text-error mb-3">{err}</p>}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => {
                if (!uploading) onClose();
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            {currentUrl && (
              <Button
                type="button"
                variant="outline"
                size="md"
                className="text-error border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20"
                onClick={removeAvatar}
                disabled={uploading || (!file && !!currentUrl)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              size="md"
              className="flex-1"
              onClick={save}
              disabled={!file || uploading}
              loading={uploading}
            >
              {lang === "hi" ? "Save करें" : "Save"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Edit Profile Modal ─────────────────────────────────────────────────────────
interface ProfileForm {
  name: string;
  street: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  preferredLang: "hi" | "en";
}
function EditProfileModal({
  open,
  onClose,
  user,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
  onSave: () => void;
}) {
  const { lang } = useLangStore();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProfileForm>({
    defaultValues: {
      name: user.name,
      street: user.street ?? "",
      line2: user.line2 ?? "",
      landmark: user.landmark ?? "",
      city: user.city ?? "",
      state: user.state ?? "",
      preferredLang: user.preferredLang,
    },
  });
  const currentLang = watch("preferredLang");
  async function onSubmit(data: ProfileForm) {
    setSaving(true);
    setErr("");
    try {
      await api.patch("/users/me", {
        name: data.name,
        street: data.street || undefined,
        line2: data.line2 || undefined,
        landmark: data.landmark || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        preferredLang: data.preferredLang,
      });
      onSave();
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }
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
        <Dialog.Content className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 w-full sm:max-w-md bg-[var(--color-surface)] dark:bg-surface-dark sm:rounded-modal shadow-modal z-modal flex flex-col max-h-screen sm:max-h-[85vh]">
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
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <Input
                label={lang === "hi" ? "पूरा नाम *" : "Full Name *"}
                {...register("name", { required: true, minLength: 2 })}
                error={errors.name ? "Min 2 chars" : undefined}
              />
              <Input label="Street" {...register("street")} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Line 2" {...register("line2")} />
                <Input label="Landmark" {...register("landmark")} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" {...register("city")} />
                <Input label="State" {...register("state")} />
              </div>
              <div>
                <label className="block text-label-md text-muted-DEFAULT dark:text-muted-dark mb-2">
                  <Languages className="w-3.5 h-3.5 inline mr-1" />
                  Language
                </label>
                <div className="flex gap-2">
                  {(["hi", "en"] as const).map((l) => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => setValue("preferredLang", l)}
                      className={`flex-1 py-2.5 rounded-xl text-label-sm font-semibold border-2 transition-all ${currentLang === l ? "bg-kridha-primary text-white border-kridha-primary" : "border-border-DEFAULT dark:border-border-dark text-muted-DEFAULT dark:text-muted-dark hover:border-kridha-primary hover:text-kridha-primary"}`}
                    >
                      {l === "hi" ? "हिंदी 🇮🇳" : "English 🇬🇧"}
                    </button>
                  ))}
                </div>
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

// ── Delete Account Modal ──────────────────────────────────────────────────────
function DeleteAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { lang } = useLangStore();
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const PHRASE = "DELETE";
  async function handle() {
    if (phrase !== PHRASE) return;
    setLoading(true);
    setErr("");
    try {
      await api.delete("/users/me");
      window.location.href = "/";
    } catch (e) {
      const ex = e as { response?: { data?: { message?: string } } };
      setErr(ex.response?.data?.message ?? "Delete failed");
      setLoading(false);
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) {
          setPhrase("");
          setErr("");
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-sm bg-[var(--color-surface)] dark:bg-surface-dark rounded-modal shadow-modal z-modal p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-error" />
            </div>
            <button
              onClick={() => {
                if (!loading) {
                  setPhrase("");
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
              ? "Permanent — undo नहीं होगा। सभी orders और data हट जाएंगे।"
              : "Permanent and irreversible. All orders and data will be removed."}
          </Dialog.Description>
          <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark mb-2">
            {lang === "hi"
              ? `"${PHRASE}" type करें confirm के लिए:`
              : `Type "${PHRASE}" to confirm:`}
          </p>
          <input
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={PHRASE}
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
                  setPhrase("");
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
              disabled={phrase !== PHRASE || loading}
            >
              {lang === "hi" ? "Delete करें" : "Delete Account"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function BuyerProfilePage() {
  const { lang } = useLangStore();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ["user-me"],
    queryFn: () => api.get("/users/me").then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });
  const { data: ordersData } = useQuery<{ meta: { total: number } }>({
    queryKey: ["orders-count"],
    queryFn: () => api.get("/orders?limit=1").then((r) => r.data),
    staleTime: 60_000,
  });
  const { data: savedData } = useQuery<{ meta: { total: number } }>({
    queryKey: ["saved-count"],
    queryFn: () => api.get("/saved?limit=1").then((r) => r.data.data),
    staleTime: 60_000,
  });
  const { data: notifData } = useQuery<{ unreadCount: number }>({
    queryKey: ["notif-count"],
    queryFn: () => api.get("/notifications?limit=1").then((r) => r.data),
    staleTime: 30_000,
  });

  function inv() {
    qc.invalidateQueries({ queryKey: ["user-me"] });
  }

  if (isLoading)
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse ${i === 0 ? "h-48" : "h-32"}`}
          />
        ))}
      </div>
    );
  if (!user) return null;

  const editBtn = (
    <button
      onClick={() => setEditOpen(true)}
      className="flex items-center gap-1 text-label-xs text-kridha-primary hover:underline"
    >
      <Pencil className="w-3 h-3" />
      Edit
    </button>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Hero */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl overflow-hidden">
        <div className="relative h-24 w-full rounded-2xl overflow-hidden mb-3">
                    <Image
                      src= "/images/kridha_logo_footer.png"
                      alt= "kridha"
                      fill
                      className="object-cover"
                    />
                </div>
        <div className="px-5 pb-5 -mt-10 flex items-end justify-between gap-4 flex-wrap">
          <div className="relative">
            <button
              onClick={() => setAvatarOpen(true)}
              className="relative w-20 h-20 rounded-2xl border-4 border-[var(--color-surface)] dark:border-surface-dark overflow-hidden bg-kridha-secondary dark:bg-kridha-primary/10 group"
            >
              {user.profileImageUrl ? (
                <Image
                  src={user.profileImageUrl}
                  alt={user.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <span className="absolute inset-0 flex items-center justify-center text-kridha-primary font-bold text-2xl">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Pencil className="w-4 h-4 text-white" />
              </div>
            </button>
            {user.isFlagged && (
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-500 border-2 border-[var(--color-surface)] flex items-center justify-center"
                title="Account restricted"
              >
                <AlertCircle className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pt-10">
            <h1 className="text-h4 font-bold text-[var(--color-text)] truncate">
              {user.name}
            </h1>
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
              {user.city ?? ""}
              {user.state ? `, ${user.state}` : ""}
            </p>
            <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-0.5">
              {user.preferredLang === "hi" ? "हिंदी" : "English"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-kridha-primary text-kridha-primary text-label-sm font-semibold hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
            <Link
              href="/notifications"
              className="relative p-2.5 rounded-xl border border-border-DEFAULT dark:border-border-dark hover:border-kridha-primary hover:bg-kridha-secondary dark:hover:bg-kridha-primary/10 transition-all"
            >
              <Bell className="w-5 h-5 text-[var(--color-text)]" />
              {(notifData?.unreadCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-kridha-primary text-white text-[10px] font-bold flex items-center justify-center">
                  {notifData!.unreadCount > 9 ? "9+" : notifData!.unreadCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<Package className="w-4 h-4" />}
          label={lang === "hi" ? "Orders" : "Orders"}
          value={ordersData?.meta?.total ?? 0}
          href="/orders"
        />
        <StatCard
          icon={<Heart className="w-4 h-4" />}
          label={lang === "hi" ? "Favourites" : "Favourites"}
          value={savedData?.meta?.total ?? 0}
          href="/saved?type=FAVOURITE"
        />
        <StatCard
          icon={<BookmarkIcon className="w-4 h-4" />}
          label={lang === "hi" ? "Saved" : "Saved"}
          value={0}
          href="/saved?type=SAVED_FOR_LATER"
        />
      </div>

      {/* Buyer metrics */}
      <div className="bg-[var(--color-surface)] dark:bg-surface-dark border border-border-DEFAULT dark:border-border-dark rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-label-sm font-semibold text-[var(--color-text)]">
            {lang === "hi" ? "Reliability Score" : "Reliability Score"}
          </p>
          <p className="text-label-sm font-bold text-kridha-primary">
            {user.reliabilityScore}%
          </p>
        </div>
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${user.reliabilityScore}%`,
              background:
                user.reliabilityScore >= 80
                  ? "var(--color-kridha-primary)"
                  : user.reliabilityScore >= 50
                    ? "#D97706"
                    : "#DC2626",
            }}
          />
        </div>
        <p className="text-label-xs text-muted-DEFAULT dark:text-muted-dark mt-1.5">
          {user.reliabilityScore >= 80
            ? "Excellent — on-time pickups"
            : user.reliabilityScore >= 50
              ? "Good — keep improving"
              : "Needs attention — high no-show count"}
        </p>
      </div>

      {/* Profile Details */}
      <Section
        icon={<MapPin className="w-4 h-4" />}
        title={lang === "hi" ? "Profile Details" : "Profile Details"}
        action={editBtn}
      >
        <KV label={lang === "hi" ? "नाम" : "Name"} value={user.name} />
        <KV
          label={lang === "hi" ? "Phone" : "Phone"}
          value={user.phone}
          masked
        />
        <KV label="Street" value={user.street} />
        <KV label="Line 2" value={user.line2} />
        <KV label="Landmark" value={user.landmark} />
        <KV label="City" value={user.city} />
        <KV label="State" value={user.state} />
        <KV
          label={lang === "hi" ? "Language" : "Language"}
          value={user.preferredLang === "hi" ? "हिंदी" : "English"}
        />
        <KV
          label={lang === "hi" ? "Member since" : "Member since"}
          value={new Date(user.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        />
      </Section>

      {/* Account Metrics */}
      <Section
        icon={<Star className="w-4 h-4" />}
        title={lang === "hi" ? "Account Metrics" : "Account Metrics"}
      >
        <KV
          label={lang === "hi" ? "Reliability" : "Reliability"}
          value={`${user.reliabilityScore}%`}
        />
        <KV
          label={lang === "hi" ? "No-show count" : "No-show count"}
          value={user.noShowCount}
        />
        <KV
          label={lang === "hi" ? "Credit balance" : "Credit balance"}
          value={`₹${user.creditBalance}`}
        />
        <div className="flex items-start justify-between py-2.5 gap-4">
          <span className="text-label-sm text-muted-DEFAULT dark:text-muted-dark min-w-[120px]">
            {lang === "hi" ? "Account status" : "Account status"}
          </span>
          {user.isFlagged ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-950/40 text-error border border-red-200 dark:border-red-800">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Restricted
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Active
            </span>
          )}
        </div>
        {user.noShowCount > 0 && (
          <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-label-xs text-amber-700 dark:text-amber-400">
              {lang === "hi"
                ? `${user.noShowCount} no-show recorded। Pickup window में ज़रूर पहुंचें।`
                : `${user.noShowCount} no-show(s) recorded. Please arrive within your pickup window.`}
            </p>
          </div>
        )}
      </Section>

      {/* Quick Links */}
      <Section
        icon={<Package className="w-4 h-4" />}
        title={lang === "hi" ? "Quick Links" : "Quick Links"}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            {
              href: "/orders",
              label: lang === "hi" ? "मेरे Orders" : "My Orders",
              icon: <Package className="w-4 h-4" />,
            },
            {
              href: "/products",
              label: lang === "hi" ? "Browse" : "Browse Products",
              icon: <ShoppingCart className="w-4 h-4" />,
            },
            {
              href: "/saved?type=FAVOURITE",
              label: lang === "hi" ? "Favourites" : "Favourites",
              icon: <Heart className="w-4 h-4" />,
            },
            {
              href: "/saved?type=SAVED_FOR_LATER",
              label: lang === "hi" ? "Saved" : "Saved for later",
              icon: <BookmarkIcon className="w-4 h-4" />,
            },
            {
              href: "/notifications",
              label: lang === "hi" ? "Notifications" : "Notifications",
              icon: <Bell className="w-4 h-4" />,
            },
            {
              href: "/support",
              label: lang === "hi" ? "Support" : "Help & Support",
              icon: <AlertCircle className="w-4 h-4" />,
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
        <div className="px-5 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-label-md font-semibold text-error">
              Delete Account
            </p>
            <p className="text-label-sm text-muted-DEFAULT dark:text-muted-dark">
              Permanent and irreversible.
            </p>
          </div>
          <button
            onClick={() => setDelOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-error text-label-sm font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors flex-shrink-0"
          >
            <UserX className="w-4 h-4" />
            Delete Account
          </button>
        </div>
      </div>

      {/* Modals */}
      {user && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          user={user}
          onSave={() => {
            inv();
            setEditOpen(false);
          }}
        />
      )}
      {user && (
        <EditAvatarModal
          open={avatarOpen}
          onClose={() => setAvatarOpen(false)}
          currentUrl={user.profileImageUrl}
          onSave={inv}
        />
      )}
      <DeleteAccountModal open={delOpen} onClose={() => setDelOpen(false)} />
    </div>
  );
}
