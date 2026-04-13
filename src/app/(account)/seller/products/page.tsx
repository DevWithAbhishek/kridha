"use client";

import { Product } from "@/types/dashboard";
import { useState } from "react";
import { AddProductModal } from "@/components/modals/AddProductModal";
import EditProductModal from "@/components/modals/EditProductModal";
import DeleteProductModal from "@/components/modals/DeleteProductModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function SellerProductsPage() {
    const [search, setSearch] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    // const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    // const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
    const queryClient = useQueryClient();

    const { data: products = [], isLoading } = useQuery({
        queryKey: ["seller-products"],
        queryFn: async () => {
            const res = await fetch("/api/products/mine", {
                credentials: "include",
            });

            const json = await res.json();
            return json.data;
        },
    });


    const filtered = products.filter(
        (p: Product) =>
            p.nameEn.toLowerCase().includes(search.toLowerCase()) ||
            p.nameHi?.includes(search)
    );

    return (
        <div className="p-4 space-y-4">

            <div className="flex justify-between">
                <h2>मेरे Products</h2>
                <button
                    onClick={() => setIsAddOpen(true)}
                    className="bg-kridha-primary text-white px-3 py-2 rounded-btn">
                    Add Product
                </button>
            </div>

            <input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border px-3 py-2 w-full rounded-md"
            />

            <div className="bg-surface rounded-card border border-border overflow-hidden">
                {filtered.map((p: Product) => (
                    <div
                        key={p.id}
                        className="flex justify-between px-5 py-3 border-b"
                    >
                        <div>
                            <div>{p.nameHi}</div>
                            <div className="text-muted text-sm">
                                {p.category}
                            </div>
                        </div>

                        {/* <div className="flex gap-3">
                            <button onClick={() => setEditingProduct(p)}>Edit</button>
                            <button
                                onClick={() => setDeletingProduct(p)}
                                className="text-error">Delete</button>
                        </div> */}
                    </div>
                ))}
            </div>
            {/* ✅ ADD MODAL */}
            <AddProductModal
                open={isAddOpen}
                onClose={() => setIsAddOpen(false)}
                onSave={() => {
                    queryClient.invalidateQueries({ queryKey: ["seller-products"] });
                }}
            />

            {/* // ✅ EDIT MODAL
            {editingProduct && (
                <EditProductModal
                    open={!!editingProduct}
                    product={{
                        id: editingProduct.id,
                        name: editingProduct.nameEn, // ⚠️ mapping needed
                        price: editingProduct.min_price ?? 0,
                    }}
                    onClose={() => setEditingProduct(null)}
                    onSave={fetchProducts}
                />
            )} */}

            {/* ✅ DELETE MODAL */}
            {/* {deletingProduct && (
                <DeleteProductModal
                    open={!!deletingProduct}
                    productId={deletingProduct.id}
                    productName={deletingProduct.nameEn}
                    onClose={() => setDeletingProduct(null)}
                    onConfirm={fetchProducts}
                />
            )} */}
        </div>
    );
}