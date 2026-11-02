"use server";

import { createClient } from "@/lib/supabase/server";
import { getOwnProfileId } from "@/lib/supabase/profile";

export async function getOwnCertifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      error: "Not authenticated",
      certifications: [],
    };
  }

  const profileId = await getOwnProfileId(supabase, user.id);
  if (!profileId) {
    return { ok: true as const, error: "", certifications: [] };
  }

  let { data, error } = await supabase
    .from("licenses")
    .select(
      "id, license_name, category, issuing_organization, acquired_date, document_path_private, verification_status, owner_visible, document_public",
    )
    .eq("profile_id", profileId)
    .order("created_at");

  const documentDisclosureReady = !error;
  if (error?.code === "42703" || error?.code === "PGRST204") {
    const legacy = await supabase
      .from("licenses")
      .select(
        "id, license_name, category, issuing_organization, acquired_date, document_path_private, verification_status, owner_visible",
      )
      .eq("profile_id", profileId)
      .order("created_at");
    data =
      legacy.data?.map((row) => ({ ...row, document_public: false })) ?? null;
    error = legacy.error;
  }

  if (error) {
    console.error("[getOwnCertifications] Supabase error:", error);
    return { ok: false as const, error: error.message, certifications: [] };
  }

  return {
    ok: true as const,
    error: "",
    documentDisclosureReady,
    certifications: (data ?? []).map((lic) => ({
      id: lic.id,
      name: lic.license_name,
      category: lic.category ?? "",
      issuer: lic.issuing_organization ?? "",
      // DB stores a full DATE; the <input type="month"> UI needs "YYYY-MM".
      issueDate: lic.acquired_date?.slice(0, 7) ?? "",
      documentPath: lic.document_path_private ?? "",
      verificationStatus: lic.verification_status,
      ownerVisible: lic.owner_visible,
      documentPublic: lic.document_public,
    })),
  };
}

export async function saveCertifications(data: {
  certifications: Array<{
    id?: string;
    certName: string;
    category?: string;
    issuer?: string;
    issueDate?: string;
    documentPath?: string;
    ownerVisible?: boolean;
    documentPublic?: boolean;
  }>;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Not authenticated" };
    }

    const schema = await supabase
      .from("licenses")
      .select("document_public")
      .limit(0);
    const missingDisclosure =
      schema.error?.code === "42703" || schema.error?.code === "PGRST204";
    if (
      schema.error &&
      (!missingDisclosure ||
        data.certifications.some((cert) => cert.documentPublic))
    )
      return {
        ok: false,
        error:
          "증빙파일 공개 방식은 현재 미리보기입니다. 서버 연결 후 저장할 수 있습니다.",
      };

    // Delete + insert must happen inside one SECURITY DEFINER call: the delete
    // sends an approved profile back to pending, which the owner_insert RLS
    // policy would then reject, leaving the rows deleted and unreplaced.
    // owner_visible must be threaded through (see saveExperience for why).
    const { data: result, error } = await supabase.rpc("save_own_licenses", {
      p_licenses: data.certifications.map((cert) => ({
        license_name: cert.certName,
        category: cert.category || null,
        issuing_organization: cert.issuer || null,
        // <input type="month"> gives "YYYY-MM"; the DB column is a full DATE.
        acquired_date: cert.issueDate ? `${cert.issueDate}-01` : null,
        document_path_private: cert.documentPath || null,
        owner_visible: cert.ownerVisible ?? true,
        ...(!missingDisclosure
          ? { document_public: cert.documentPublic ?? false }
          : {}),
      })),
    });

    if (error) {
      console.error("[saveCertifications] Supabase error:", error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: "Unexpected response" };
  } catch (err) {
    console.error("[saveCertifications] threw:", err);
    return { ok: false, error: String(err) };
  }
}

// 항목별 공개/비공개 토글 — "저장" 버튼과 무관하게 즉시 확정된다.
export async function setOwnLicenseVisibility(
  licenseId: string,
  visible: boolean,
) {
  try {
    const supabase = await createClient();
    const { data: result, error } = await supabase.rpc(
      "set_own_license_visibility",
      {
        p_license_id: licenseId,
        p_visible: visible,
      },
    );

    if (error) {
      console.error("[setOwnLicenseVisibility] Supabase error:", error);
      return { ok: false, error: error.message };
    }

    if (result && result.length > 0) {
      const { ok, error: rpcError } = result[0];
      return { ok, error: rpcError };
    }

    return { ok: false, error: "Unexpected response" };
  } catch (err) {
    console.error("[setOwnLicenseVisibility] threw:", err);
    return { ok: false, error: String(err) };
  }
}

export async function setOwnLicenseDocumentVisibility(
  licenseId: string,
  documentPublic: boolean,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "set_own_license_document_visibility",
    {
      p_license_id: licenseId,
      p_public: documentPublic,
    },
  );
  if (error)
    return {
      ok: false,
      error: "공개 방식을 저장하지 못했습니다. 다시 시도해주세요.",
    };
  return data?.[0] ?? { ok: false, error: "공개 방식을 저장하지 못했습니다." };
}
