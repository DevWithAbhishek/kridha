export default function ReliabilityDonut({
    rating,
    size = "md",
}: {
    rating: number;
    size?: "sm" | "md" | "lg";
}) {
    const sizeMap = {
        sm: "w-20 h-20",
        md: "w-28 h-28",
        lg: "w-36 h-36",
    };

    return (
        <div className="p-5 rounded-card border bg-surface text-center">
            <h3 className="font-bold mb-4">Reliability rating</h3>

            <svg viewBox="0 0 36 36" className={`-rotate-90 ${sizeMap[size]}`}>
                <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    stroke="#E9F5F3"
                    strokeWidth="3"
                    fill="none"
                />
                <circle
                    cx="18"
                    cy="18"
                    r="15.9"
                    stroke="#2A9D8F"
                    strokeWidth="3"
                    strokeDasharray={`${rating} ${100 - rating}`}
                    strokeLinecap="round"
                    fill="none"
                />
            </svg>

            <div className="mt-2 font-bold">{rating}%</div>
        </div>
    );
}