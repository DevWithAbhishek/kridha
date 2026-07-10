// prisma/seed.ts
// Kridha marketplace seed — 10 verified sellers, 540 products (27 templates × 2 variants × 10 sellers),
// 1080 price tiers (2/product), ~108 active deals (20% of products),
// 2 pickup windows per seller, 1 buyer test account, PlatformConfig singleton.
//
// Run:   npx prisma db seed
// PIN for all accounts: 1234

import "dotenv/config";
import {
  PrismaClient,
  Role,
  Language,
  BusinessType,
  ProductCategory,
  ProductUnit,
  DealStatus,
  SellerStatus,
  KycStatus,
  Prisma,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import cuid from "cuid";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

process.env.NODE_ENV !== "production";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function randomPointNearby(
  baseLat: number,
  baseLng: number,
  maxKm: number,
): { lat: number; lng: number } {
  const angle = Math.random() * 2 * Math.PI;
  const r = Math.sqrt(Math.random()); // uniform-in-disk — prevents centre-clustering
  const latDeg = maxKm / 111;
  const lngDeg = maxKm / (111 * Math.cos((baseLat * Math.PI) / 180));
  return {
    lat: parseFloat((baseLat + r * latDeg * Math.cos(angle)).toFixed(6)),
    lng: parseFloat((baseLng + r * lngDeg * Math.sin(angle)).toFixed(6)),
  };
}

function jitter(lat: number, lng: number): { lat: number; lng: number } {
  return randomPointNearby(lat, lng, 2);
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function roundTo(n: number, decimals: number): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const BASE_LAT = 26.713; // Gorakhpur, UP
const BASE_LNG = 83.330;

const CITIES = [
  "Gorakhpur",
  "Deoria",
  "Basti",
  "Maharajganj",
  "Kushinagar",
  "Sant Kabir Nagar",
  "Pipraich",
  "Sahjanwa",
  "Campierganj",
  "Gola Bazar",
];

const SELLER_DATA = [
  {
    name: "Ram Kisan Sharma",
    storeName: "Sharma Grain Traders",
    street: "14 Mandi Road, Civil Lines",
    businessType: BusinessType.PROPRIETORSHIP,
  },
  {
    name: "Mohd Salim Khan",
    storeName: "Khan Mustard Oil Mill",
    street: "23 Mill Quarter, Near Bus Stand",
    businessType: BusinessType.INDIVIDUAL,
  },
  {
    name: "Suresh Yadav",
    storeName: "Yadav Dairy Farm",
    street: "7 Dairy Colony, Pipraich Road",
    businessType: BusinessType.PARTNERSHIP,
  },
  {
    name: "Deepak Gupta",
    storeName: "Gupta Flour Mill",
    street: "45 Industrial Area, Phase 1",
    businessType: BusinessType.PROPRIETORSHIP,
  },
  {
    name: "Rajan Verma",
    storeName: "Verma Spice Centre",
    street: "8 Spice Bazaar, Old Market",
    businessType: BusinessType.INDIVIDUAL,
  },
  {
    name: "Sanjay Mishra",
    storeName: "Mishra Agro Store",
    street: "31 Farmers Colony, GT Road",
    businessType: BusinessType.PARTNERSHIP,
  },
  {
    name: "Abdul Karim",
    storeName: "Karim Wholesale Mart",
    street: "12 Wholesale Market, Station Road",
    businessType: BusinessType.PROPRIETORSHIP,
  },
  {
    name: "Prem Narayan Singh",
    storeName: "Singh General Traders",
    street: "56 Kisan Nagar, Ring Road",
    businessType: BusinessType.INDIVIDUAL,
  },
  {
    name: "Ramesh Tiwari",
    storeName: "Tiwari Grocery House",
    street: "3 Main Market, Near Post Office",
    businessType: BusinessType.PARTNERSHIP,
  },
  {
    name: "Vinod Kumar Patel",
    storeName: "Patel Cold Storage",
    street: "88 Cold Storage Road, Bypass",
    businessType: BusinessType.PVT_LTD,
  },
];

function generatePhones(count: number): string[] {
  const used = new Set<string>();
  const phones: string[] = [];
  while (phones.length < count) {
    const first = [6, 7, 8, 9][Math.floor(Math.random() * 4)];
    let num = `${first}`;
    for (let i = 0; i < 9; i++) num += Math.floor(Math.random() * 10);
    const full = `${num}`;
    if (!used.has(full)) {
      used.add(full);
      phones.push(full);
    }
  }
  return phones;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCT TEMPLATES — 27 covering ALL 10 ProductCategory enum values
// ─────────────────────────────────────────────────────────────────────────────

interface Template {
  category: ProductCategory;
  nameEn: string;
  nameHi: string;
  unit: ProductUnit;
  basePrice: number;
  minQty: number;
  increment: number;
  availMin: number;
  availMax: number;
}

const TEMPLATES: Template[] = [
  // GRAINS (4)
  {
    category: "GRAINS",
    nameEn: "Basmati Rice",
    nameHi: "बासमती चावल",
    unit: "KG",
    basePrice: 78,
    minQty: 10,
    increment: 5,
    availMin: 500,
    availMax: 5000,
  },
  {
    category: "GRAINS",
    nameEn: "Non-Basmati Rice",
    nameHi: "सामान्य चावल",
    unit: "KG",
    basePrice: 40,
    minQty: 10,
    increment: 5,
    availMin: 500,
    availMax: 5000,
  },
  {
    category: "GRAINS",
    nameEn: "Wheat",
    nameHi: "गेहूं",
    unit: "KG",
    basePrice: 25,
    minQty: 20,
    increment: 10,
    availMin: 500,
    availMax: 5000,
  },
  {
    category: "GRAINS",
    nameEn: "Maize",
    nameHi: "मक्का",
    unit: "KG",
    basePrice: 20,
    minQty: 20,
    increment: 10,
    availMin: 300,
    availMax: 4000,
  },
  // FLOUR (3)
  {
    category: "FLOUR",
    nameEn: "Wheat Flour (Atta)",
    nameHi: "गेहूं का आटा",
    unit: "KG",
    basePrice: 32,
    minQty: 10,
    increment: 5,
    availMin: 200,
    availMax: 3000,
  },
  {
    category: "FLOUR",
    nameEn: "Maize Flour",
    nameHi: "मक्के का आटा",
    unit: "KG",
    basePrice: 28,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "FLOUR",
    nameEn: "Gram Flour (Besan)",
    nameHi: "बेसन",
    unit: "KG",
    basePrice: 65,
    minQty: 5,
    increment: 5,
    availMin: 100,
    availMax: 1500,
  },
  // OIL (4)
  {
    category: "OIL",
    nameEn: "Mustard Oil",
    nameHi: "सरसों का तेल",
    unit: "LITRE",
    basePrice: 140,
    minQty: 5,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "OIL",
    nameEn: "Soybean Oil",
    nameHi: "सोयाबीन तेल",
    unit: "LITRE",
    basePrice: 120,
    minQty: 5,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "OIL",
    nameEn: "Sunflower Oil",
    nameHi: "सूरजमुखी तेल",
    unit: "LITRE",
    basePrice: 130,
    minQty: 5,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "OIL",
    nameEn: "Groundnut Oil",
    nameHi: "मूंगफली का तेल",
    unit: "LITRE",
    basePrice: 160,
    minQty: 5,
    increment: 5,
    availMin: 50,
    availMax: 1000,
  },
  // DAIRY (3)
  {
    category: "DAIRY",
    nameEn: "Fresh Milk",
    nameHi: "ताजा दूध",
    unit: "LITRE",
    basePrice: 55,
    minQty: 5,
    increment: 1,
    availMin: 50,
    availMax: 500,
  },
  {
    category: "DAIRY",
    nameEn: "Paneer",
    nameHi: "पनीर",
    unit: "KG",
    basePrice: 280,
    minQty: 2,
    increment: 1,
    availMin: 20,
    availMax: 200,
  },
  {
    category: "DAIRY",
    nameEn: "Ghee",
    nameHi: "देसी घी",
    unit: "KG",
    basePrice: 500,
    minQty: 1,
    increment: 1,
    availMin: 10,
    availMax: 200,
  },
  // PULSES (5)
  {
    category: "PULSES",
    nameEn: "Chana Dal",
    nameHi: "चना दाल",
    unit: "KG",
    basePrice: 85,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "PULSES",
    nameEn: "Moong Dal",
    nameHi: "मूंग दाल",
    unit: "KG",
    basePrice: 95,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "PULSES",
    nameEn: "Urad Dal",
    nameHi: "उड़द दाल",
    unit: "KG",
    basePrice: 100,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "PULSES",
    nameEn: "Toor Dal",
    nameHi: "तुअर दाल",
    unit: "KG",
    basePrice: 110,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  {
    category: "PULSES",
    nameEn: "Masoor Dal",
    nameHi: "मसूर दाल",
    unit: "KG",
    basePrice: 90,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 2000,
  },
  // SPICES (3)
  {
    category: "SPICES",
    nameEn: "Turmeric Powder",
    nameHi: "हल्दी पाउडर",
    unit: "KG",
    basePrice: 150,
    minQty: 5,
    increment: 1,
    availMin: 20,
    availMax: 200,
  },
  {
    category: "SPICES",
    nameEn: "Red Chilli Powder",
    nameHi: "लाल मिर्च",
    unit: "KG",
    basePrice: 160,
    minQty: 5,
    increment: 1,
    availMin: 20,
    availMax: 200,
  },
  {
    category: "SPICES",
    nameEn: "Coriander Powder",
    nameHi: "धनिया पाउडर",
    unit: "KG",
    basePrice: 120,
    minQty: 5,
    increment: 1,
    availMin: 20,
    availMax: 200,
  },
  // VEGETABLES (1)
  {
    category: "VEGETABLES",
    nameEn: "Potato",
    nameHi: "आलू",
    unit: "KG",
    basePrice: 25,
    minQty: 20,
    increment: 10,
    availMin: 200,
    availMax: 3000,
  },
  // FRUITS (1)
  {
    category: "FRUITS",
    nameEn: "Banana",
    nameHi: "केला",
    unit: "DOZEN",
    basePrice: 40,
    minQty: 10,
    increment: 5,
    availMin: 100,
    availMax: 1000,
  },
  // BEVERAGES (2)
  {
    category: "BEVERAGES",
    nameEn: "Sugarcane Juice",
    nameHi: "गन्ने का रस",
    unit: "LITRE",
    basePrice: 30,
    minQty: 10,
    increment: 5,
    availMin: 50,
    availMax: 500,
  },
  {
    category: "BEVERAGES",
    nameEn: "Lassi",
    nameHi: "लस्सी",
    unit: "LITRE",
    basePrice: 50,
    minQty: 5,
    increment: 5,
    availMin: 30,
    availMax: 300,
  },
  // OTHER (1)
  {
    category: "OTHER",
    nameEn: "Sugar",
    nameHi: "चीनी",
    unit: "KG",
    basePrice: 42,
    minQty: 20,
    increment: 10,
    availMin: 200,
    availMax: 3000,
  },
];

const BRANDS: Record<string, string[]> = {
  OIL: ["Fortune", "Dhara", "Adani Wilmar", "Saffola"],
  FLOUR: ["Aashirvaad", "Patanjali", "Pillsbury", "Nature Fresh"],
  DAIRY: ["Amul", "Parag", "Mother Dairy", "Param"],
  GRAINS: ["Daawat", "India Gate", "Kohinoor", "Lal Qilla"],
  PULSES: ["Tata Sampann", "Haldiram", "24 Mantra", "Patanjali"],
  SPICES: ["Everest", "MDH", "Badshah", "Catch"],
  VEGETABLES: ["Farm Fresh", "Fresh & Go"],
  FRUITS: ["Go Bananas", "Fresh Bazar"],
  BEVERAGES: ["Sugarcane King", "Dairy Best"],
  OTHER: ["Uttam Sugar", "EID Parry"],
};

function getBrand(cat: ProductCategory): string {
  const list = BRANDS[cat as string] ?? BRANDS.OTHER;
  return list[Math.floor(Math.random() * list.length)] ?? "Local Brand";
}

interface ProductRow {
  sellerId: string;
  nameEn: string;
  nameHi: string;
  description: string;
  category: ProductCategory;
  isBranded: boolean;
  unit: ProductUnit;
  unitIncrement: number;
  minOrderQuantity: number;
  maxOrderQuantity: number;
  available: number;
  latitude: number;
  longitude: number;
  city: string;
}

function buildVariations(
  tmpl: Template,
  sellerId: string,
  lat: number,
  lng: number,
  city: string,
  priceMod: number,
): ProductRow[] {
  const loc1 = jitter(lat, lng);
  const loc2 = jitter(lat, lng);
  const brand = getBrand(tmpl.category);
  const avail1 = randInt(tmpl.availMin, tmpl.availMax);
  const avail2 = randInt(tmpl.availMin, Math.floor(tmpl.availMax * 0.7));

  return [
    {
      sellerId,
      nameEn: `${tmpl.nameEn} (Local)`,
      nameHi: `${tmpl.nameHi} (स्थानीय)`,
      description: `Premium quality ${tmpl.nameEn.toLowerCase()} sourced from local farmers. Freshly milled, no additives.`,
      category: tmpl.category,
      isBranded: false,
      unit: tmpl.unit,
      unitIncrement: tmpl.increment,
      minOrderQuantity: tmpl.minQty,
      maxOrderQuantity: tmpl.availMax,
      available: avail1,
      latitude: loc1.lat,
      longitude: loc1.lng,
      city,
    },
    {
      sellerId,
      nameEn: `${tmpl.nameEn} (${brand})`,
      nameHi: `${tmpl.nameHi} (${brand})`,
      description: `Branded ${tmpl.nameEn.toLowerCase()} by ${brand}. Machine cleaned, quality sealed. Preferred by retail chains.`,
      category: tmpl.category,
      isBranded: true,
      unit: tmpl.unit,
      unitIncrement: tmpl.increment,
      minOrderQuantity: tmpl.minQty,
      maxOrderQuantity: tmpl.availMax,
      available: avail2,
      latitude: loc2.lat,
      longitude: loc2.lng,
      city,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Kridha seed starting...\n");

  // ── STEP 1: CLEANUP ────────────────────────────────────────────────────────
  console.log("🗑️   Cleaning up existing data...");
  await prisma.adminAuditLog.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.webhookLog.deleteMany();
  await prisma.refund.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.subOrder.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cartSession.deleteMany();
  await prisma.savedProduct.deleteMany();
  await prisma.review.deleteMany();
  await prisma.priceTier.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.product.deleteMany();
  await prisma.pickupWindow.deleteMany();
  await prisma.sellerProfile.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.otpRequest.deleteMany();
  await prisma.user.deleteMany();
  console.log("   ✅  Cleanup complete\n");

  // ── STEP 2: PLATFORM CONFIG ────────────────────────────────────────────────
  await prisma.platformConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      platformFeePercent: 2.0,
      minPlatformFee: 10,
      maxPlatformFee: 500,
      minOrderAmountPerSeller: 1000,
      advanceCapAmount: 500,
      advanceMinAmount: 100,
      advancePercent: 5.0,
      noShowPenalty: 20,
      reliabilityDecrement: 15,
    },
    update: {},
  });
  console.log("⚙️   PlatformConfig upserted\n");

  // ── STEP 3: HASH PIN ────────────────────────────────────────────────────────
  const pinHash = await argon2.hash("1234");

  // ── STEP 4: COORDINATES + PHONES ──────────────────────────────────────────
  const sellerCoords = SELLER_DATA.map(() =>
    randomPointNearby(BASE_LAT, BASE_LNG, 50),
  );
  const phones = generatePhones(11);

  // ── STEP 5: SELLER USERS ──────────────────────────────────────────────────
  console.log("👤  Creating seller users...");
  const sellerUsers = await Promise.all(
    SELLER_DATA.map((s, i) =>
      prisma.user.create({
        data: {
          phone: phones[i],
          pinHash: pinHash,
          name: s.name,
          city: CITIES[i],
          state: "Uttar Pradesh",
          preferredLang: "hi" as Language,
          roles: ["BUYER", "SELLER"] as Role[],
          reliabilityScore: 100,
        },
      }),
    ),
  );
  console.log(`   ✅  ${sellerUsers.length} seller users created\n`);

  // ── STEP 6: SELLER PROFILES ───────────────────────────────────────────────
  console.log("🏪  Creating seller profiles...");
  await Promise.all(
    SELLER_DATA.map((s, i) =>
      prisma.sellerProfile.create({
        data: {
          userId: sellerUsers[i].id,
          storeName: s.storeName,
          street: s.street,
          city: CITIES[i],
          state: "Uttar Pradesh",
          pinCode: `${273000 + randInt(1, 99)}`,
          latitude: sellerCoords[i].lat,
          longitude: sellerCoords[i].lng,
          businessType: s.businessType,
          panNumber: `${["AASP", "BKLT", "CMRV", "DGJK", "EKNS"][i % 5]}${randInt(1000, 9999)}F`,
          kycStatus: "VERIFIED" as KycStatus,
          profileStatus: "VERIFIED" as SellerStatus,
          bankVerified: true,
          accountHolderName: s.name,
          accountNumber: `${randInt(10000000, 99999999)}${randInt(1000, 9999)}`,
          ifscCode: [
            "SBIN0001234",
            "PUNB0123400",
            "HDFC0000123",
            "UTIB0001234",
            "UBIN0123456",
          ][i % 5],
          bankName: [
            "State Bank of India",
            "Punjab National Bank",
            "HDFC Bank",
            "Axis Bank",
            "Union Bank",
          ][i % 5],
          sellerRating: roundTo(rand(3.5, 5.0), 1),
          sellerRatingCount: randInt(10, 200),
          reliabilityScore: roundTo(rand(70, 100), 0),
          storeImages: [],
        },
      }),
    ),
  );
  console.log(`   ✅  ${SELLER_DATA.length} seller profiles created\n`);

  // ── STEP 7: PICKUP WINDOWS ────────────────────────────────────────────────
  console.log("🕐  Creating pickup windows...");
  await prisma.pickupWindow.createMany({
    data: sellerUsers.flatMap((u) => [
      {
        sellerId: u.id,
        labelEn: "Morning Slot",
        labelHi: "सुबह का समय",
        startTime: "06:00",
        endTime: "10:00",
        daysActive: [1, 2, 3, 4, 5, 6],
      },
      {
        sellerId: u.id,
        labelEn: "Evening Slot",
        labelHi: "शाम का समय",
        startTime: "16:00",
        endTime: "19:00",
        daysActive: [1, 2, 3, 4, 5],
      },
    ]),
  });
  console.log(`   ✅  ${sellerUsers.length * 2} pickup windows created\n`);

  // ── STEP 8: PRODUCTS via raw INSERT ──────────────────────────────────────
  // WHY RAW INSERT (not createMany):
  //   The `location` column is Unsupported("geography(Point,4326)") — Prisma
  //   skips it in createMany. We use raw INSERT to include latitude/longitude.
  //
  // WHY location IS NOT IN THE INSERT:
  //   `location` is a GENERATED ALWAYS column in Neon — Postgres computes it
  //   automatically from latitude/longitude. Setting it manually throws error 428C9.
  //   We insert latitude + longitude → Postgres generates location automatically.
  //   The 50km geographic distribution is fully preserved via latitude/longitude.
  console.log("📦  Creating products...");

  const allProductRows: ProductRow[] = [];
  sellerUsers.forEach((user, i) => {
    const priceMod = rand(-0.15, 0.2);
    const { lat, lng } = sellerCoords[i];
    TEMPLATES.forEach((tmpl) => {
      allProductRows.push(
        ...buildVariations(tmpl, user.id, lat, lng, CITIES[i], priceMod),
      );
    });
  });

  // Batch in groups of 50 — avoids Neon statement size limits
  const BATCH = 50;
  const insertedIds: string[] = [];

  for (let i = 0; i < allProductRows.length; i += BATCH) {
    const batch = allProductRows.slice(i, i + BATCH);
    const ids = await Promise.all(
      batch.map(async (p) => {
        const result = await prisma.$queryRaw<{ id: string }[]>`
          INSERT INTO "Product" (
            "id","sellerId", "nameEn", "nameHi", "description",
            "category", "isBranded", "unit", "unitIncrement",
            "minOrderQuantity", "maxOrderQuantity", "available",
            "imageUrls", "latitude", "longitude", "city",
            "productStatus", "updatedAt"
          ) VALUES (
            ${cuid()},
            ${p.sellerId},
            ${p.nameEn},
            ${p.nameHi},
            ${p.description},
            ${p.category}::"ProductCategory",
            ${p.isBranded},
            ${p.unit}::"ProductUnit",
            ${p.unitIncrement},
            ${p.minOrderQuantity},
            ${p.maxOrderQuantity},
            ${p.available},
            ARRAY[]::TEXT[],
            ${p.latitude},
            ${p.longitude},
            ${p.city},
            'ACTIVE'::"ProductStatus",
            NOW()
          )
          RETURNING "id"
        `;
        return result[0].id;
      }),
    );
    insertedIds.push(...ids);
    console.log(
      `   📦  ${Math.min(i + BATCH, allProductRows.length)}/${allProductRows.length} inserted...`,
    );
  }

  console.log(`   ✅  ${insertedIds.length} products created\n`);

  // ── STEP 9: PRICE TIERS ────────────────────────────────────────────────────
  console.log("💰  Creating price tiers...");

  const allProducts = await prisma.product.findMany({
    select: { id: true, nameEn: true, minOrderQuantity: true },
  });

  const allTierInputs: Prisma.PriceTierCreateManyInput[] = [];
  for (const prod of allProducts) {
    const baseName = prod.nameEn.replace(/ \(.*\)$/, "");
    const tmpl = TEMPLATES.find((t) => t.nameEn === baseName);
    const tmplPrice = tmpl?.basePrice ?? 50;
    const isBranded = !prod.nameEn.includes("(Local)");
    const sellerMod = rand(-0.15, 0.2);
    const basePrice = roundTo(
      tmplPrice * (1 + sellerMod) * (isBranded ? 1.08 : 1),
      2,
    );
    const minQ = prod.minOrderQuantity;

    allTierInputs.push(
      {
        productId: prod.id,
        minQty: minQ,
        maxQty: minQ * 4,
        pricePerUnit: basePrice,
      },
      {
        productId: prod.id,
        minQty: minQ * 4 + 0.01,
        maxQty: null,
        pricePerUnit: roundTo(basePrice * 0.9, 2),
      },
    );
  }
  await prisma.priceTier.createMany({ data: allTierInputs });
  console.log(`   ✅  ${allTierInputs.length} price tiers created\n`);

  // ── STEP 10: DEALS ────────────────────────────────────────────────────────
  console.log("🏷️   Creating deals on 20% of products...");

  const dealCount = Math.floor(allProducts.length * 0.2);
  const shuffledIds = [...allProducts]
    .sort(() => Math.random() - 0.5)
    .slice(0, dealCount);
  const dealProducts = await prisma.product.findMany({
    where: { id: { in: shuffledIds.map((p) => p.id) } },
    select: { id: true, sellerId: true },
  });

  const now = new Date();
  await prisma.deal.createMany({
    data: dealProducts.map((p) => ({
      productId: p.id,
      sellerId: p.sellerId,
      discountPercent: roundTo(rand(5, 20), 0),
      expiresAt: new Date(now.getTime() + rand(24, 7 * 24) * 3600 * 1000),
      status: "ACTIVE" as DealStatus,
    })),
  });
  console.log(`   ✅  ${dealProducts.length} active deals created\n`);

  // ── STEP 11: TEST BUYER ───────────────────────────────────────────────────
  const buyerPhone = phones[10];
  await prisma.user.create({
    data: {
      phone: buyerPhone,
      pinHash: pinHash,
      name: "Test Buyer",
      city: "Gorakhpur",
      state: "Uttar Pradesh",
      preferredLang: "hi" as Language,
      roles: ["BUYER"] as Role[],
      reliabilityScore: 100,
    },
  });
  console.log(`👤  Test buyer created: ${buyerPhone}\n`);

  // ── STEP 12: SUMMARY ──────────────────────────────────────────────────────
  const finalProductCount = await prisma.product.count();
  const finalDealCount = await prisma.deal.count();

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("✅  KRIDHA SEED COMPLETE");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log(`\n📊  Products created   : ${finalProductCount}`);
  console.log(
    `🏷️   Deals created      : ${finalDealCount} (~${((finalDealCount / finalProductCount) * 100).toFixed(0)}% of products)`,
  );
  console.log(
    `🗂️   Categories         : GRAINS, FLOUR, OIL, DAIRY, PULSES, SPICES, VEGETABLES, FRUITS, BEVERAGES, OTHER`,
  );
  console.log(
    `\n🏪  All 10 sellers are VERIFIED (KYC ✅  Profile ✅  Bank ✅)\n`,
  );
  console.log("📱  Seller login phones (PIN: 1234 for all):");
  SELLER_DATA.forEach((s, i) => {
    console.log(
      `   ${String(i + 1).padStart(2, " ")}. ${phones[i]}  —  ${s.storeName.padEnd(28)} (${CITIES[i]})`,
    );
  });
  console.log(`\n👤  Test buyer phone   : ${buyerPhone}  (PIN: 1234)`);
  console.log(
    "\n═══════════════════════════════════════════════════════════════\n",
  );
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
