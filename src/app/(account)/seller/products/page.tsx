"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, Search, PackageX } from "lucide-react";
import { AddProductModal } from "@/components/modals/AddProductModal";
import { EditProductModal } from "@/components/modals/EditProductModal";
import { DeleteProductModal } from "@/components/modals/DeleteProductModal";
import { useLangStore } from "@/stores/langStore";
import { api } from "@/lib/api";
import type { SellerProduct } from "@/types/dashboard";
import { ProductWithRelations } from "@/repo/product.repo";
import { useTranslations } from "next-intl";

// Card for loading state
function SkeletonRow() {
  return (
    <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 aspect-[3/4] animate-pulse" />
  );
}

export default function SellerProductsPage() {
  const { lang } = useLangStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingProduct, setEditingProduct] =
    useState<ProductWithRelations | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<{
    id: string;
    nameEn: string;
  } | null>(null);
  const t = useTranslations("sellerProducts");

  const { data: products = [], isLoading } = useQuery<SellerProduct[]>({
    queryKey: ["seller-products"],
    queryFn: async () => {
      const res = await api.get("/products/mine");
      return res.data.data;
    },
  });

  // Stock badge (more compact; mobile friendly)
  function StockBadge({ available }: { available: number }) {
    if (available === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300">
          {t("stock_out")}
        </span>
      );
    }
    if (available <= 10) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
          {t("stock_low")}: {available}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
        {t("stock_available")}: {available}
      </span>
    );
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["seller-products"] });
  }

  const filtered = products.filter(
    (p) =>
      p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      (p.nameHi ?? "").includes(search),
  );

  return (
    <div className="px-2 py-4 sm:p-6 max-w-2xl md:max-w-4xl mx-auto w-full">
      {/* Header & Add button */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t("title")}
          </h2>
          {!isLoading && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {products.length} {t("count")}
            </p>
          )}
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center justify-center gap-2 bg-[var(--color-primary,#2563eb)] hover:bg-[var(--color-primary-hover,#1d4ed8)] text-white px-4 py-2 rounded-xl font-semibold shadow-sm transition min-h-[44px] w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden xs:inline">{t("add_product")}</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          placeholder={t("search_placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 outline-none transition"
        />
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-4">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
        {!isLoading && filtered.length === 0 && (
          <div className="col-span-full py-8 flex flex-col items-center text-gray-400 dark:text-gray-500">
            <PackageX className="w-12 h-12 mb-3" />
            <div className="text-sm font-medium">{t("no_products")}</div>
          </div>
        )}

        {!isLoading &&
          filtered.map((p) => (
            <div
              key={p.id}
              className="relative bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-xl group flex flex-col"
            >
              {/* Image with fixed ratio */}
              <div className="relative w-full aspect-[4/3] bg-gray-100 dark:bg-gray-900 overflow-hidden">
                {p.imageUrls?.[0] ? (
                  <Image
                    src={p.imageUrls[0]}
                    alt={p.nameEn}
                    fill
                    sizes="(max-width:480px) 100vw, (max-width:1024px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-200 group-hover:scale-105"
                    style={{ borderRadius: "0 0 1rem 1rem" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-300 dark:text-gray-700 text-sm">
                    <PackageX className="w-9 h-9" />
                  </div>
                )}

                {/* Image count badge */}
                {p.imageUrls?.length > 1 && (
                  <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                    +{p.imageUrls.length - 1}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col justify-between p-4 space-y-2">
                <div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-1">
                    {lang === "hi" ? p.nameHi || p.nameEn : p.nameEn}
                  </h3>
                  {p.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-300 mt-0.5 line-clamp-2">
                      {p.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs mt-3">
                    <StockBadge available={p.available} />
                    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <span>{p.unit}</span>
                    </span>
                    <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300 min-w-fit">{`${t("min_order")}: ${p.minOrderQuantity}`}</span>
                  </div>
                </div>
                {/* Actions */}
                <div className="flex gap-2 pt-3">
                  <button
                    title="Edit"
                    aria-label="Edit"
                    onClick={async () => {
                      const res = await api.get(`/products/mine/${p.id}`);
                      setEditingProduct(res.data.data);
                    }}
                    className="flex-1 flex justify-center items-center rounded-lg h-9 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900 group/edit transition focus:ring-2 focus:ring-blue-400 dark:focus:ring-blue-500"
                  >
                    <Pencil className="w-5 h-5 text-blue-700 dark:text-blue-400 group-hover/edit:scale-110 transition" />
                  </button>
                  <button
                    title="Delete"
                    aria-label="Delete"
                    onClick={() =>
                      setDeletingProduct({ id: p.id, nameEn: p.nameEn })
                    }
                    className="flex-1 flex justify-center items-center rounded-lg h-9 bg-gray-100 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900 group/delete transition focus:ring-2 focus:ring-red-400 dark:focus:ring-red-500"
                  >
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400 group-hover/delete:scale-110 transition" />
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Add/Edit/Delete Modals */}
      <AddProductModal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSave={() => {
          invalidate();
          setIsAddOpen(false);
        }}
      />
      {editingProduct && (
        <EditProductModal
          open={true}
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={() => {
            invalidate();
            setEditingProduct(null);
          }}
        />
      )}
      {deletingProduct && (
        <DeleteProductModal
          open={true}
          productId={deletingProduct.id}
          productName={deletingProduct.nameEn}
          onClose={() => setDeletingProduct(null)}
          onConfirm={() => {
            invalidate();
            setDeletingProduct(null);
          }}
        />
      )}
    </div>
  );
}
