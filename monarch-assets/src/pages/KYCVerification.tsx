import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Upload, User, FileText, Camera, ArrowRight, ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWalletAuth } from "@/hooks/use-wallet-auth";
import { useKycStatus } from "@/hooks/use-kyc-status";
import { submitKyc } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

type PersonalInfo = {
  fullName: string;
  dateOfBirth: string;
  country: string;
  address: string;
};

type UploadedFiles = {
  idFront: File | null;
  idBack: File | null;
  selfie: File | null;
};

const STEPS = [
  { id: 1, label: "Personal Info", icon: User },
  { id: 2, label: "Documents", icon: FileText },
  { id: 3, label: "Review", icon: ShieldCheck }
];

function FileUploadBox({
  label,
  hint,
  icon: Icon,
  file,
  onFile
}: {
  label: string;
  hint: string;
  icon: React.ElementType;
  file: File | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          file
            ? "border-green-500/50 bg-green-500/5"
            : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
        )}
      >
        {file ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <span className="text-sm font-medium text-green-600">{file.name}</span>
            <span className="text-xs text-muted-foreground">Click to replace</span>
          </>
        ) : (
          <>
            <Icon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs text-muted-foreground">{hint}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Upload className="h-3 w-3" /> JPG, PNG, PDF · max 5 MB
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

export default function KYCVerification() {
  const { token } = useWalletAuth();
  const { kycStatus, submission, refetch } = useKycStatus();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [personal, setPersonal] = useState<PersonalInfo>({
    fullName: "",
    dateOfBirth: "",
    country: "",
    address: ""
  });
  const [personalErrors, setPersonalErrors] = useState<Partial<PersonalInfo>>({});

  const [files, setFiles] = useState<UploadedFiles>({
    idFront: null,
    idBack: null,
    selfie: null
  });
  const [fileError, setFileError] = useState<string | null>(null);

  // Already approved state
  if (kycStatus === "APPROVED" && !done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <ShieldCheck className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Identity Verified</CardTitle>
            <CardDescription>Your KYC verification is complete. You have full access to Monarch.</CardDescription>
          </CardHeader>
          {submission && (
            <CardContent className="space-y-2 text-sm">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Full name</span>
                  <span className="font-medium">{submission.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of birth</span>
                  <span className="font-medium">{submission.dateOfBirth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <span className="font-medium">{submission.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Verified</span>
                  <span className="font-medium">{new Date(submission.submittedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/dashboard")}>
                Go to Dashboard
              </Button>
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  function validatePersonal(): boolean {
    const errs: Partial<PersonalInfo> = {};
    if (!personal.fullName.trim() || personal.fullName.trim().length < 2) errs.fullName = "Full name is required";
    if (!personal.dateOfBirth) errs.dateOfBirth = "Date of birth is required";
    if (!personal.country.trim()) errs.country = "Country is required";
    if (!personal.address.trim() || personal.address.trim().length < 5) errs.address = "Address is required";
    setPersonalErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateFiles(): boolean {
    if (!files.idFront || !files.idBack || !files.selfie) {
      setFileError("All three documents are required.");
      return false;
    }
    setFileError(null);
    return true;
  }

  async function handleSubmit() {
    if (!token) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append("fullName", personal.fullName.trim());
      formData.append("dateOfBirth", personal.dateOfBirth);
      formData.append("country", personal.country.trim());
      formData.append("address", personal.address.trim());
      formData.append("idFront", files.idFront!);
      formData.append("idBack", files.idBack!);
      formData.append("selfie", files.selfie!);

      await submitKyc(token, formData);
      await queryClient.invalidateQueries({ queryKey: ["kyc-status"] });
      refetch();
      setDone(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Card>
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold">Verified!</h2>
            <p className="text-sm text-muted-foreground">
              Your identity has been verified. You can now invest and list assets on Monarch.
            </p>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Identity Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Required to invest and list assets. Takes about 2 minutes.
        </p>
      </div>

      {/* Step indicators */}
      <div className="mb-8 flex items-center justify-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isComplete = step > s.id;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                    isComplete
                      ? "border-green-500 bg-green-500 text-white"
                      : isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={cn("text-xs font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("mx-3 mb-4 h-px w-16 transition-colors", step > s.id ? "bg-green-500" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step 1 — Personal Info */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
            <CardDescription>Enter your legal details exactly as they appear on your ID.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full legal name</Label>
              <Input
                id="fullName"
                placeholder="Jane Smith"
                value={personal.fullName}
                onChange={(e) => setPersonal((p) => ({ ...p, fullName: e.target.value }))}
              />
              {personalErrors.fullName && (
                <p className="text-xs text-destructive">{personalErrors.fullName}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={personal.dateOfBirth}
                onChange={(e) => setPersonal((p) => ({ ...p, dateOfBirth: e.target.value }))}
              />
              {personalErrors.dateOfBirth && (
                <p className="text-xs text-destructive">{personalErrors.dateOfBirth}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country of residence</Label>
              <Input
                id="country"
                placeholder="United States"
                value={personal.country}
                onChange={(e) => setPersonal((p) => ({ ...p, country: e.target.value }))}
              />
              {personalErrors.country && (
                <p className="text-xs text-destructive">{personalErrors.country}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Residential address</Label>
              <Textarea
                id="address"
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
                value={personal.address}
                onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value }))}
              />
              {personalErrors.address && (
                <p className="text-xs text-destructive">{personalErrors.address}</p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (validatePersonal()) setStep(2);
              }}
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Document Upload */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Documents</CardTitle>
            <CardDescription>Upload clear photos of your government-issued ID and a selfie.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FileUploadBox
              label="Government ID — Front"
              hint="Passport, driver's license, or national ID"
              icon={FileText}
              file={files.idFront}
              onFile={(f) => setFiles((prev) => ({ ...prev, idFront: f }))}
            />
            <FileUploadBox
              label="Government ID — Back"
              hint="Back side of your ID document"
              icon={FileText}
              file={files.idBack}
              onFile={(f) => setFiles((prev) => ({ ...prev, idBack: f }))}
            />
            <FileUploadBox
              label="Selfie holding your ID"
              hint="Hold your ID next to your face, ensure both are clearly visible"
              icon={Camera}
              file={files.selfie}
              onFile={(f) => setFiles((prev) => ({ ...prev, selfie: f }))}
            />

            {fileError && <p className="text-xs text-destructive">{fileError}</p>}

            <div className="flex gap-3">
              <Button variant="outline" className="w-full" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                className="w-full"
                onClick={() => {
                  if (validateFiles()) setStep(3);
                }}
              >
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Review & Submit */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review & Submit</CardTitle>
            <CardDescription>Confirm your details are correct before submitting.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Info</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Full name</span>
                  <span className="font-medium">{personal.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date of birth</span>
                  <span className="font-medium">{personal.dateOfBirth}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country</span>
                  <span className="font-medium">{personal.country}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Address</span>
                  <span className="font-medium text-right">{personal.address}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: "ID Front", file: files.idFront },
                  { label: "ID Back", file: files.idBack },
                  { label: "Selfie", file: files.selfie }
                ].map(({ label, file }) => (
                  <div key={label} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">{label}</span>
                    {file ? (
                      <Badge variant="outline" className="border-green-500/50 text-green-600 text-xs">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {file.name.length > 24 ? file.name.slice(0, 24) + "…" : file.name}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Missing</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {submitError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="w-full" onClick={() => setStep(2)} disabled={isSubmitting}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Submitting…" : "Submit & Verify"}
                {!isSubmitting && <ShieldCheck className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
