const USE_CASES = [
  {
    quote:
      "We used to spend half a day sourcing mustard oil from three different mandis. Now one order, one pickup, done.",
    name: "R. Gupta",
    role: "Kirana Store",
    location: "Gorakhpur",
    type: "Buyer",
  },
  {
    quote:
      "Selling in bulk tiers meant we could quote a fair price upfront instead of haggling over every order.",
    name: "S. Yadav",
    role: "Rice Mill",
    location: "Prayagraj",
    type: "Supplier",
  },
  {
    quote:
      "OTP pickup meant we didn't have to wire money and just hope the order showed up correctly.",
    name: "M. Singh",
    role: "Restaurant",
    location: "Kanpur",
    type: "Buyer",
  },
];

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-kridha-primary/10 text-kridha-primary text-label-sm font-semibold flex-shrink-0">
      {initials}
    </div>
  );
}

export function TestimonialsSection() {
  return (
    <section className="bg-background-subtle dark:bg-gray-800 py-section-y">
      <div className="max-w-page mx-auto px-page-x md:px-page-x-md">
        <div className="mb-10 max-w-[560px]">
          <h2 className="text-h3 font-bold text-[var(--color-text)] mb-2">
            Built for Buyers and Suppliers
          </h2>
          <p className="text-body-md text-muted-dark">
            Showing how local businesses use Kridha day to
            day.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {USE_CASES.map((item, index) => (
            <div
              key={index}
              className="bg-[var(--color-surface)] dark:bg-surface-dark rounded-card shadow-card p-card border border-[var(--color-border)] flex flex-col"
            >
              <span className="text-[10px] font-bold text-muted-dark uppercase tracking-widest mb-4">
                Trusted By
              </span>

              <p className="text-body-md text-[var(--color-text)] mb-6 flex-1">
                {item.quote}
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-[var(--color-border)]">
                <Avatar name={item.name} />
                <div>
                  <div className="text-label-md font-semibold text-[var(--color-text)]">
                    {item.name}
                  </div>
                  <div className="text-label-sm text-muted-dark">
                    {item.role} • {item.location}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
