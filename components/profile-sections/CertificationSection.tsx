"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useId,
} from "react";
import {
  getOwnCertifications,
  saveCertifications,
  setOwnLicenseVisibility,
  setOwnLicenseDocumentVisibility,
} from "@/app/actions/certification";
import { createClient } from "@/lib/supabase/client";
import { getEvidenceFileUrl } from "@/lib/storage/evidence-file-url";
import { LICENSE_STATUS_META } from "@/lib/constants/status-badges";
import { VisibilityToggle } from "./VisibilityToggle";
import type { SectionSaveHandle } from "./types";

type Certification = {
  id: string;
  name: string;
  category: string;
  issuer: string;
  issueDate: string;
  documentPath: string;
  // 방금 추가해 아직 저장 전인 항목은 서버 상태가 없다 — undefined는
  // "검토 대기"(not_submitted와 동일한 의미)로 취급한다.
  verificationStatus?: string;
  ownerVisible: boolean;
  documentPublic: boolean;
};

const LICENSE_CATEGORIES = [
  "국가면허",
  "국가자격",
  "민간자격",
  "교육수료",
  "세미나수료",
  "교육활동",
  "봉사활동",
];

const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EVIDENCE_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const EVIDENCE_EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};

type Props = {
  // 프로필 마스터 토글이 꺼져 있으면 항목별 토글을 비활성화한다.
  profileOwnerVisible?: boolean;
};

const CertificationSection = forwardRef<SectionSaveHandle, Props>(
  function CertificationSection({ profileOwnerVisible = true }, ref) {
    const [certifications, setCertifications] = useState<Certification[]>([]);
    const [newCert, setNewCert] = useState({
      name: "",
      category: "",
      issuer: "",
      issueDate: "",
      documentPath: "",
      documentPublic: false,
    });
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<typeof newCert | null>(null);
    const [fileUploading, setFileUploading] = useState(false);
    const [fileError, setFileError] = useState("");
    const [addError, setAddError] = useState("");
    const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
      "loading",
    );
    const [documentDisclosureReady, setDocumentDisclosureReady] =
      useState(false);
    const [visibilityError, setVisibilityError] = useState("");
    const [documentSavingId, setDocumentSavingId] = useState<string | null>(
      null,
    );
    const [togglingId, setTogglingId] = useState<string | null>(null);

    useEffect(() => {
      getOwnCertifications()
        .then((result) => {
          if (!result.ok) {
            setLoadState("error");
            return;
          }
          setCertifications(result.certifications);
          setDocumentDisclosureReady(result.documentDisclosureReady === true);
          setLoadState("ready");
        })
        .catch(() => setLoadState("error"));
    }, []);

    const handleToggleVisibility = async (id: string) => {
      const target = certifications.find((cert) => cert.id === id);
      if (!target) return;

      const nextVisible = !target.ownerVisible;
      setTogglingId(id);
      setCertifications((prev) =>
        prev.map((cert) =>
          cert.id === id ? { ...cert, ownerVisible: nextVisible } : cert,
        ),
      );

      const result = await setOwnLicenseVisibility(id, nextVisible);
      if (!result.ok) {
        setCertifications((prev) =>
          prev.map((cert) =>
            cert.id === id ? { ...cert, ownerVisible: !nextVisible } : cert,
          ),
        );
        alert(result.error);
      }
      setTogglingId(null);
    };

    const changeDocumentVisibility = async (
      id: string,
      documentPublic: boolean,
    ) => {
      setVisibilityError("");
      setDocumentSavingId(id);
      try {
        // Newly added rows have no server identity until the section is saved.
        if (!documentDisclosureReady || !/^[0-9a-f-]{36}$/i.test(id)) {
          setCertifications((prev) =>
            prev.map((cert) =>
              cert.id === id ? { ...cert, documentPublic } : cert,
            ),
          );
          return;
        }
        const result = await setOwnLicenseDocumentVisibility(
          id,
          documentPublic,
        );
        if (!result.ok) {
          setVisibilityError(result.error);
          return;
        }
        setCertifications((prev) =>
          prev.map((cert) =>
            cert.id === id ? { ...cert, documentPublic } : cert,
          ),
        );
      } catch {
        setVisibilityError(
          "공개 방식을 저장하지 못했습니다. 다시 시도해주세요.",
        );
      } finally {
        setDocumentSavingId(null);
      }
    };

    const commonCerts = [
      "ISSA CPT",
      "NASM-CPT",
      "ACE CPT",
      "IFBB Pro Card",
      "필라테스 자격증",
      "요가 자격증",
      "헬스케어 운동사",
      "스포츠 마사지 자격증",
    ];

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;

      if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
        setFileError("jpg, png, pdf 파일만 업로드할 수 있습니다");
        return;
      }
      if (file.size > MAX_EVIDENCE_BYTES) {
        setFileError("10MB 이하의 파일만 업로드할 수 있습니다");
        return;
      }

      setFileError("");
      setFileUploading(true);

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setFileError("로그인이 필요합니다");
          return;
        }

        const ext = EVIDENCE_EXT_BY_TYPE[file.type];
        // Random filename, not tied to a license row id — saveCertifications
        // deletes and re-inserts every license row on each save, so a path
        // keyed by the (unstable) license id would break on re-save.
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("evidence-files")
          .upload(path, file, { contentType: file.type });

        if (uploadError) {
          setFileError(`업로드에 실패했습니다: ${uploadError.message}`);
          return;
        }

        setNewCert((prev) => ({ ...prev, documentPath: path }));
      } finally {
        setFileUploading(false);
      }
    };

    const handleAddCertification = () => {
      if (newCert.name.trim() && newCert.issuer.trim()) {
        if (!newCert.documentPath) {
          setAddError("증빙 파일을 첨부해야 자격증을 추가할 수 있습니다");
          return;
        }
        setAddError("");
        setCertifications([
          ...certifications,
          {
            id: Date.now().toString(),
            ...newCert,
            ownerVisible: true,
          },
        ]);
        setNewCert({
          name: "",
          category: "",
          issuer: "",
          issueDate: "",
          documentPath: "",
          documentPublic: false,
        });
      }
    };

    const handleEditStart = (cert: Certification) => {
      setEditingId(cert.id);
      setEditForm({
        name: cert.name,
        category: cert.category,
        issuer: cert.issuer,
        issueDate: cert.issueDate,
        documentPath: cert.documentPath,
        documentPublic: cert.documentPublic,
      });
    };

    const handleEditSave = (id: string) => {
      if (editForm) {
        setCertifications(
          certifications.map((cert) =>
            cert.id === id ? { ...cert, ...editForm } : cert,
          ),
        );
        setEditingId(null);
        setEditForm(null);
      }
    };

    const handleEditCancel = () => {
      setEditingId(null);
      setEditForm(null);
    };

    const handleDeleteCertification = (id: string) => {
      setCertifications(certifications.filter((cert) => cert.id !== id));
    };

    const save = async (): Promise<{ ok: boolean; error?: string }> => {
      if (loadState !== "ready")
        return { ok: false, error: "자격·면허를 불러온 후 저장해주세요." };
      const result = await saveCertifications({
        certifications: certifications.map((cert) => ({
          id: cert.id,
          certName: cert.name,
          category: cert.category,
          issuer: cert.issuer,
          issueDate: cert.issueDate,
          documentPath: cert.documentPath,
          documentPublic: cert.documentPublic,
          ownerVisible: cert.ownerVisible,
        })),
      });
      if (!result.ok) return { ok: false, error: result.error };
      const fresh = await getOwnCertifications();
      if (fresh.ok) setCertifications(fresh.certifications);
      else setLoadState("error");
      return { ok: true };
    };

    useImperativeHandle(ref, () => ({ save }), [certifications, loadState]);

    return (
      <div className="space-y-5">
        <p className="text-sm leading-6 text-slate-600">
          두 방식 모두 관리자 확인 후 인증 배지가 표시됩니다. 증빙파일 공개
          여부는 자격·면허마다 선택할 수 있습니다.
        </p>
        {loadState === "loading" && (
          <p role="status" className="text-sm text-slate-500">
            자격·면허를 불러오는 중입니다.
          </p>
        )}
        {loadState === "error" && (
          <p role="alert" className="text-sm text-red-600">
            자격·면허를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.
          </p>
        )}
        {visibilityError && (
          <p role="alert" className="text-sm text-red-600">
            {visibilityError}
          </p>
        )}

        {loadState === "ready" && !documentDisclosureReady && (
          <p
            role="status"
            className="rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-700"
          >
            공개 방식 선택 미리보기입니다. 아직 저장·실제 파일 공개에는 반영되지
            않습니다.
          </p>
        )}
        {!profileOwnerVisible && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              전체 비공개 상태입니다. 사이드바의 프로필 공개 설정을 켜야 항목별
              공개 설정이 적용됩니다.
            </p>
          </div>
        )}

        {/* Add New Certification */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-gray-900">자격증 추가</h3>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              자격증명
            </label>
            <input
              type="text"
              list="common-certs"
              placeholder="예: ISSA CPT"
              value={newCert.name}
              onChange={(e) =>
                setNewCert({
                  ...newCert,
                  name: e.target.value,
                })
              }
              className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <datalist id="common-certs">
              {commonCerts.map((cert) => (
                <option key={cert} value={cert} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              카테고리
            </label>
            <select
              value={newCert.category}
              onChange={(e) =>
                setNewCert({
                  ...newCert,
                  category: e.target.value,
                })
              }
              className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택 안 함</option>
              {LICENSE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">
                발급처
              </label>
              <input
                type="text"
                placeholder="예: ISSA"
                value={newCert.issuer}
                onChange={(e) =>
                  setNewCert({
                    ...newCert,
                    issuer: e.target.value,
                  })
                }
                className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">
                발급일
              </label>
              <input
                type="month"
                value={newCert.issueDate}
                onChange={(e) =>
                  setNewCert({
                    ...newCert,
                    issueDate: e.target.value,
                  })
                }
                className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-2 block">
              증빙 파일 (필수)
            </label>
            {newCert.documentPath ? (
              <div className="flex items-center justify-between bg-white border border-gray-300 rounded-lg px-4 py-2">
                <span className="text-sm text-blue-600 font-medium">
                  ✓ 업로드 완료
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setNewCert((prev) => ({ ...prev, documentPath: "" }))
                  }
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  제거
                </button>
              </div>
            ) : (
              <label className="block bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors">
                <span className="text-sm text-gray-600">
                  {fileUploading ? "⏳ 업로드 중..." : "📎 증빙 파일 업로드"}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  jpg, png, pdf / 10MB 이하
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={handleFileChange}
                  disabled={fileUploading}
                  className="hidden"
                />
              </label>
            )}
            {fileError && (
              <p className="text-xs text-red-500 mt-1">{fileError}</p>
            )}
          </div>

          <DocumentDisclosureChoice
            value={newCert.documentPublic}
            onChange={(value) =>
              setNewCert((prev) => ({ ...prev, documentPublic: value }))
            }
          />

          {addError && <p className="text-xs text-red-500">{addError}</p>}

          <button
            type="button"
            onClick={handleAddCertification}
            className="w-full min-h-tap px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium flex items-center justify-center"
          >
            + 자격증 추가
          </button>
        </div>

        {/* List Certifications */}
        {certifications.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900">
              추가된 자격증 ({certifications.length})
            </h3>
            {certifications.map((cert) => (
              <div
                key={cert.id}
                className="bg-white border border-gray-200 rounded-lg p-4 space-y-3"
              >
                {editingId !== cert.id && (
                  <DocumentDisclosureChoice
                    value={cert.documentPublic}
                    onChange={(value) =>
                      changeDocumentVisibility(cert.id, value)
                    }
                    disabled={documentSavingId !== null}
                  />
                )}
                {editingId === cert.id ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editForm?.name || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm!,
                          name: e.target.value,
                        })
                      }
                      className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="예: ISSA CPT"
                    />
                    <input
                      type="text"
                      value={editForm?.issuer || ""}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm!,
                          issuer: e.target.value,
                        })
                      }
                      className="bg-white text-gray-900 placeholder:text-gray-400 w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      placeholder="예: ISSA"
                    />
                    <DocumentDisclosureChoice
                      value={editForm?.documentPublic ?? false}
                      onChange={(value) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, documentPublic: value } : prev,
                        )
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditSave(cert.id)}
                        className="min-h-tap px-4 py-2 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 flex items-center justify-center"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={handleEditCancel}
                        className="min-h-tap px-4 py-2 bg-gray-300 text-gray-900 text-sm rounded hover:bg-gray-400 flex items-center justify-center"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">
                          {cert.name}
                          {cert.category && (
                            <span className="ml-2 text-xs text-gray-500">
                              {cert.category}
                            </span>
                          )}
                          {(() => {
                            const meta =
                              LICENSE_STATUS_META[
                                cert.verificationStatus ?? "not_submitted"
                              ] ?? LICENSE_STATUS_META.not_submitted;
                            return (
                              <span
                                className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
                              >
                                {meta.label}
                              </span>
                            );
                          })()}
                        </p>
                        <p className="text-sm text-gray-600">
                          발급처: {cert.issuer}
                        </p>
                        {cert.issueDate && (
                          <p className="text-xs text-gray-500 mt-1">
                            {cert.issueDate}
                          </p>
                        )}
                        {cert.documentPath && (
                          <a
                            href={
                              getEvidenceFileUrl(cert.documentPath) ?? undefined
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block text-xs text-blue-600 hover:text-blue-800 mt-1"
                          >
                            📎 증빙 파일 보기
                          </a>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditStart(cert)}
                            className="min-h-tap px-3 py-2 text-blue-500 hover:text-blue-700 font-medium whitespace-nowrap flex items-center justify-center"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCertification(cert.id)}
                            className="min-h-tap px-3 py-2 text-red-500 hover:text-red-700 font-medium whitespace-nowrap flex items-center justify-center"
                          >
                            삭제
                          </button>
                        </div>
                        <span className="text-xs text-slate-500">
                          자격 정보 공개 여부
                        </span>
                        <VisibilityToggle
                          visible={cert.ownerVisible}
                          onToggle={() => handleToggleVisibility(cert.id)}
                          disabled={!profileOwnerVisible}
                          pending={togglingId === cert.id}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

export function DocumentDisclosureChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const group = useId();
  return (
    <fieldset
      disabled={disabled}
      className="space-y-2 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
    >
      <legend className="px-1 text-sm font-semibold text-slate-900">
        증빙파일 공개 방식
      </legend>
      {[
        {
          value: false,
          title: "파일 비공개 · 인증 배지만 표시",
          description: "증빙파일은 본인과 관리자만 확인합니다.",
        },
        {
          value: true,
          title: "파일 공개 · 인증 배지와 함께 표시",
          description:
            "관리자 승인 후 공개 프로필에서 증빙파일을 열람할 수 있습니다.",
        },
      ].map((option) => (
        <label
          key={String(option.value)}
          className="flex cursor-pointer items-start gap-3 rounded-lg bg-white p-3 text-sm"
        >
          <input
            type="radio"
            name={group}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="mt-1 accent-blue-600"
          />
          <span>
            <span className="block font-medium text-slate-900">
              {option.title}
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              {option.description}
            </span>
          </span>
        </label>
      ))}
      {value && (
        <p className="text-xs leading-5 text-slate-500">
          공개할 파일은 주민등록번호·주소 등 불필요한 개인정보를 가린 후
          첨부해주세요. 공개 후에는 다른 사람이 파일을 저장할 수 있습니다.
        </p>
      )}
    </fieldset>
  );
}

export default CertificationSection;
