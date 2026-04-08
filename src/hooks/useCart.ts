"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CartSession, CartItem } from "@/types/dashboard";

export function useCart() {
  const queryClient = useQueryClient();

  const { data: cart, isLoading: loading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const res = await api.get("/cart");
      return res.data as CartSession;
    },
  });

  const addItem = useMutation({
    mutationFn: async (data: {
      productId: string;
      quantity: number;
      pickupWindowId: string;
      pickupDate: string;
    }) => {
      const res = await api.post("/cart", data);
      return res.data;
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartSession>(["cart"]);
      if (previous) {
        queryClient.setQueryData<CartSession>(["cart"], {
          ...previous,
          items: [...previous.items, newItem as CartItem],
        });
      }
      return { previous };
    },
    onError: (err, newItem, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string;
      quantity: number;
    }) => {
      const res = await api.patch(`/cart/${itemId}`, { quantity });
      return res.data;
    },
    onMutate: async ({ itemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartSession>(["cart"]);
      if (previous) {
        queryClient.setQueryData<CartSession>(["cart"], {
          ...previous,
          items: previous.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item,
          ),
        });
      }
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/cart/${itemId}`);
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: ["cart"] });
      const previous = queryClient.getQueryData<CartSession>(["cart"]);
      if (previous) {
        queryClient.setQueryData<CartSession>(["cart"], {
          ...previous,
          items: previous.items.filter((item) => item.id !== itemId),
        });
      }
      return { previous };
    },
    onError: (err, itemId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["cart"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      await api.delete("/cart");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const itemCount = cart?.summary.totalItems ?? 0;
  const totalAmount = cart?.summary.totalAmount ?? 0;

  return {
    cart,
    loading,
    addItem: addItem.mutate,
    updateItem: updateItem.mutate,
    removeItem: removeItem.mutate,
    clearCart: clearCart.mutate,
    itemCount,
    totalAmount,
  };
}
