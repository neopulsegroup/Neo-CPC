import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rulesPath = path.resolve(__dirname, "../../firestore.rules");

describe("Firestore rules — job_offers (empresa)", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "demo-firestore-rules",
      firestore: {
        rules: readFileSync(rulesPath, "utf8"),
        host: "127.0.0.1",
        port: 8082,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  afterEach(async () => {
    await testEnv.clearFirestore();
  });

  it("permite criar job_offers com users.role company, companies/{uid} e company_id == uid", async () => {
    const uid = "y3Ba2yDMmfVlYjdC5JByt7xdPK43";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection("users").doc(uid).set({
        email: "empresa@test.com",
        name: "Empresa",
        role: "company",
        active: true,
        blocked: false,
      });
      await db.collection("companies").doc(uid).set({
        user_id: uid,
        company_name: "empresa",
        verified: false,
        createdAt: "2026-03-19T21:30:59.297Z",
      });
    });

    const authed = testEnv.authenticatedContext(uid);
    const db = authed.firestore();

    await assertSucceeds(
      db.collection("job_offers").add({
        company_id: uid,
        title: "Desenvolvedor",
        description: "Detalhes",
        location: "Lisboa",
        sector: "TI",
        contract_type: "full_time",
        work_mode: "on_site",
        salary_range: "",
        requirements: "",
        status: "pending_review",
        created_at: new Date().toISOString(),
      })
    );
  });

  it("permite criar sem doc users/{uid} se profiles tem role company e existe companies/{uid}", async () => {
    const uid = "noUserDocEmployer01";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection("profiles").doc(uid).set({
        name: "Empresa X",
        email: "x@test.com",
        role: "company",
      });
      await db.collection("companies").doc(uid).set({
        user_id: uid,
        company_name: "X",
        verified: false,
      });
    });

    const authed = testEnv.authenticatedContext(uid);
    await assertSucceeds(
      authed.firestore().collection("job_offers").add({
        company_id: uid,
        title: "Vaga",
        description: null,
        location: null,
        sector: null,
        contract_type: "full_time",
        work_mode: "on_site",
        salary_range: null,
        requirements: null,
        status: "pending_review",
        created_at: new Date().toISOString(),
      })
    );
  });

  it("nega criar sem users/{uid} se não existe companies/{uid}", async () => {
    const uid = "noUserNoCompany01";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection("profiles").doc(uid).set({
        name: "Só perfil",
        email: "n@test.com",
        role: "company",
      });
    });

    const authed = testEnv.authenticatedContext(uid);
    await assertFails(
      authed.firestore().collection("job_offers").add({
        company_id: uid,
        title: "X",
        description: null,
        location: null,
        sector: null,
        contract_type: "full_time",
        work_mode: "on_site",
        salary_range: null,
        requirements: null,
        status: "pending_review",
        created_at: new Date().toISOString(),
      })
    );
  });

  it("permite criar quando companies/{uid} existe sem user_id mas company_id == uid", async () => {
    const uid = "legacyCompanyUid01";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection("users").doc(uid).set({
        email: "leg@test.com",
        name: "Leg",
        role: "company",
        active: true,
        blocked: false,
      });
      await db.collection("companies").doc(uid).set({
        company_name: "Só nome",
        verified: false,
      });
    });

    const authed = testEnv.authenticatedContext(uid);
    await assertSucceeds(
      authed.firestore().collection("job_offers").add({
        company_id: uid,
        title: "Cargo",
        description: null,
        location: null,
        sector: null,
        contract_type: "full_time",
        work_mode: "remote",
        salary_range: null,
        requirements: null,
        status: "pending_review",
        created_at: new Date().toISOString(),
      })
    );
  });

  it("nega criação se company_id é de outra empresa", async () => {
    const owner = "ownerUid01";
    const other = "otherUid02";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      for (const u of [owner, other]) {
        await db.collection("users").doc(u).set({
          email: `${u}@t.com`,
          name: u,
          role: "company",
          active: true,
          blocked: false,
        });
        await db.collection("companies").doc(u).set({
          user_id: u,
          company_name: u,
          verified: false,
        });
      }
    });

    const authed = testEnv.authenticatedContext(owner);
    await assertFails(
      authed.firestore().collection("job_offers").add({
        company_id: other,
        title: "Fraude",
        description: null,
        location: null,
        sector: null,
        contract_type: "full_time",
        work_mode: "on_site",
        salary_range: null,
        requirements: null,
        status: "pending_review",
        created_at: new Date().toISOString(),
      })
    );
  });

  it("nega migrante sem papel empresa", async () => {
    const uid = "migrantOnly01";
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection("users").doc(uid).set({
        email: "m@test.com",
        name: "M",
        role: "migrant",
        active: true,
        blocked: false,
      });
      await db.collection("companies").doc(uid).set({
        user_id: uid,
        company_name: "Stub",
        verified: false,
      });
    });

    const authed = testEnv.authenticatedContext(uid);
    const err = await assertFails(
      authed.firestore().collection("job_offers").add({
        company_id: uid,
        title: "Não devia passar",
        description: null,
        location: null,
        sector: null,
        contract_type: "full_time",
        work_mode: "on_site",
        salary_range: null,
        requirements: null,
        status: "pending_review",
        created_at: new Date().toISOString(),
      })
    );
    expect(err).toBeDefined();
  });

  it("permite migrante com conta ativa candidatar-se a vaga active", async () => {
    const migrantUid = "migrantApply01";
    const companyUid = "companyJobOwner01";
    const jobId = "jobActive01";

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await db.collection("users").doc(migrantUid).set({
        email: "m@t.com",
        name: "Migrante",
        role: "migrant",
        active: true,
        blocked: false,
      });
      await db.collection("users").doc(companyUid).set({
        email: "c@t.com",
        name: "Empresa",
        role: "company",
        active: true,
        blocked: false,
      });
      await db.collection("companies").doc(companyUid).set({
        user_id: companyUid,
        company_name: "Empresa X",
        verified: false,
      });
      await db.collection("job_offers").doc(jobId).set({
        company_id: companyUid,
        title: "Cargo",
        description: "D",
        location: "Lisboa",
        sector: "TI",
        contract_type: "full_time",
        work_mode: "on_site",
        salary_range: null,
        requirements: null,
        status: "active",
        created_at: new Date().toISOString(),
      });
    });

    const authed = testEnv.authenticatedContext(migrantUid);
    await assertSucceeds(
      authed.firestore().collection("job_applications").add({
        job_id: jobId,
        applicant_id: migrantUid,
        cover_letter: "Olá",
        status: "submitted",
        created_at: new Date().toISOString(),
      })
    );
  });
});
