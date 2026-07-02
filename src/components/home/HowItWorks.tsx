import { getTranslations } from "next-intl/server";
import Image from "next/image";

export async function HowItWorks() {
  const t = await getTranslations("how");

  const steps = [
    {
      image: "/images/social-media.webp",
      title: t("step1_title"),
      desc: t("step1_desc"),
    },
    {
      image: "/images/payment-img.webp",
      title: t("step2_title"),
      desc: t("step2_desc"),
    },
    {
      image: "/images/onboarding.webp",
      title: t("step3_title"),
      desc: t("step3_desc"),
    },
  ];

  return (
    <section
      id="how"
      className="bg-kridha-secondary/30 dark:bg-gray-800/50 py-section-y"
    >
      <div className="max-w-page mx-auto px-page-x md:px-page-x-md">
        <div className="text-center mb-12">
          <h2 className="text-h1 font-bold text-[var(--color-text)] mb-4">
            {t("title")}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <div
              key={index}
              className="bg-[var(--color-surface)] rounded-card shadow-card p-card border border-[var(--color-border)] hover:shadow-card-hover transition-all duration-slow"
            >
              <div className="w-10 h-10 bg-kridha-primary text-white rounded-full flex items-center justify-center font-bold text-h5 mb-4">
                {index + 1}
              </div>
              <Image
                src={step.image}
                alt={step.title}
                width={200}
                height={160}
                className="h-40 object-contain mx-auto mb-4"
                loading="lazy"
              />
              <h3 className="text-h5 font-semibold mb-2">{step.title}</h3>
              <p className="text-body-sm text-[var(--color-text-muted)] leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Connecting arrows on desktop */}
        <div className="hidden lg:block">
          <div className="flex justify-center mt-8">
            <span className="text-2xl text-kridha-primary">→</span>
            <span className="text-2xl text-kridha-primary ml-8">→</span>
          </div>
        </div>

        <div className="mt-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-h3 font-bold text-[var(--color-text)]">
                See Kridha in Action
              </h3>

              <p className="mt-2 text-body text-[var(--color-text-muted)]">
                Explore the complete purchase journey — from discovering nearby
                products to placing an order with secure online payments.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-card hover:shadow-card-hover transition-all duration-300 bg-[var(--color-surface)]">
              <video
                controls
                preload="metadata"
                playsInline
                disablePictureInPicture
                controlsList="nodownload"
                className="block w-full h-auto"
                poster="/images/demo-thumbnail.png"
              >
                <source src="/videos/buyer-flow.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
