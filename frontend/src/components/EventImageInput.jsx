import React, { useRef, useState } from "react";
import { Image as ImageIcon, UploadCloud, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;

export const EventImageInput = ({ value, onChange, testIdPrefix = "event-image", inputClassName = "" }) => {
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef(null);

    const handleFile = async (file) => {
        if (!file) return;
        if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
            toast.error("Only PNG, JPG or WebP images are allowed");
            return;
        }
        if (file.size > MAX_BYTES) {
            toast.error("Image too large (max 5 MB)");
            return;
        }
        setUploading(true);
        try {
            const res = await api.uploadEventImage(file);
            onChange(res.absoluteUrl);
            toast.success("Image uploaded");
        } catch (err) {
            toast.error(err?.response?.data?.detail || "Upload failed — please try again");
        } finally {
            setUploading(false);
        }
    };

    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        handleFile(e.dataTransfer.files?.[0]);
    };

    return (
        <div className="space-y-2">
            <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                data-testid={`${testIdPrefix}-dropzone`}
                className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border bg-background/60 hover:border-primary/50"}`}
            >
                {uploading ? (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-1">
                        <UploadCloud className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm font-semibold">Drag & drop an image here, or click to browse</span>
                        <span className="text-xs text-muted-foreground">PNG, JPG or WebP — max 5 MB</span>
                    </div>
                )}
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    data-testid={`${testIdPrefix}-file-input`}
                    onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
                />
            </div>
            <div className="relative">
                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={`${inputClassName} pl-9`}
                    placeholder="…or paste an image URL (https://)"
                    data-testid={`${testIdPrefix}-url-input`}
                />
            </div>
            {value && (
                <div className="relative inline-block" data-testid={`${testIdPrefix}-preview`}>
                    <img
                        src={value}
                        alt="Event preview"
                        className="h-28 rounded-xl object-cover border border-border"
                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                    <button
                        type="button"
                        onClick={() => onChange("")}
                        data-testid={`${testIdPrefix}-remove-btn`}
                        className="absolute -top-2 -right-2 h-6 w-6 grid place-items-center rounded-full bg-foreground text-background shadow"
                        title="Remove image"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default EventImageInput;
