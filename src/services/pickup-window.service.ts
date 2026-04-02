// Creates 3 Hindi-labelled default pickup windows on seller registration.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db";

export const pickupWindowService = {
  async createDefaults(sellerId: string): Promise<void> {
    await prisma.pickupWindow.createMany({
      data: [
        {
          sellerId,
          labelHi: "सुबह",
          labelEn: "Morning",
          startTime: "08:00",
          endTime: "12:00",
          daysActive: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          sellerId,
          labelHi: "दोपहर",
          labelEn: "Afternoon",
          startTime: "12:00",
          endTime: "16:00",
          daysActive: [1, 2, 3, 4, 5, 6, 7],
        },
        {
          sellerId,
          labelHi: "शाम",
          labelEn: "Evening",
          startTime: "16:00",
          endTime: "19:00",
          daysActive: [1, 2, 3, 4, 5, 6, 7],
        },
      ],
    });
  },
};
