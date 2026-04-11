"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

interface Props {
    open: boolean;
    onClose: () => void;
    phone: string;
    onSuccess: () => void;
}

export default function ChangePinModal({
    open,
    onClose,
    phone,
    onSuccess,
}: Props) {
    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState("");
    const [pin, setPin] = useState("");

    async function requestOtp() {
        await fetch("/api/auth/reset-pin-request", {
            method: "POST",
            body: JSON.stringify({ phone }),
        });
        setStep(2);
    }

    async function change() {
        await fetch("/api/auth/reset-pin", {
            method: "POST",
            body: JSON.stringify({ phone, otp, newPin: pin }),
        });

        onSuccess();
        setTimeout(onClose, 2000);
    }

    return (
        <Dialog.Root open={open} onOpenChange={onClose}>
            <Dialog.Content className="p-6">

                {step === 1 && (
                    <button onClick={requestOtp}>OTP भेजें</button>
                )}

                {step === 2 && (
                    <>
                        <input value={otp} onChange={(e) => setOtp(e.target.value)} />
                        <input value={pin} onChange={(e) => setPin(e.target.value)} />
                        <button onClick={change}>PIN बदलें</button>
                    </>
                )}

            </Dialog.Content>
        </Dialog.Root>
    );
}