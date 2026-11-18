process.env.JWT_SECRET = "notification-pages-test-secret";

const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../app");
const { DeliveryLog, Job, JobRun, RecipientList, Template } = require("../models");

const adminToken = jwt.sign(
  { id: "672000000000000000000099", name: "Admin", role: "admin" },
  process.env.JWT_SECRET
);
const userToken = jwt.sign(
  { id: "672000000000000000000098", name: "User", role: "user" },
  process.env.JWT_SECRET
);

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Template API", () => {
  test("requires authentication to list templates", async () => {
    const response = await request(app).get("/api/templates");
    expect(response.status).toBe(401);
  });

  test("lists templates for an authenticated user", async () => {
    const templates = [{ _id: "template-1", name: "Daily report" }];
    const query = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(templates)
    };
    jest.spyOn(Template, "find").mockReturnValue(query);

    const response = await request(app)
      .get("/api/templates")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.templates).toEqual(templates);
  });

  test("creates a template for an administrator", async () => {
    const template = {
      _id: "template-1",
      name: "Daily report",
      subject: "Report for {{Date}}",
      body: "Sales: {{TotalSales}}"
    };
    const create = jest.spyOn(Template, "create").mockResolvedValue(template);

    const response = await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(template);

    expect(response.status).toBe(201);
    expect(response.body.template.name).toBe("Daily report");
    expect(create).toHaveBeenCalledWith({
      name: "Daily report",
      subject: "Report for {{Date}}",
      body: "Sales: {{TotalSales}}"
    });
  });

  test("updates an existing template for an administrator", async () => {
    const templateId = "672000000000000000000004";
    const template = {
      _id: templateId,
      name: "Weekly report",
      subject: "Weekly totals",
      body: "Orders: {{Orders}}"
    };
    const update = jest.spyOn(Template, "findByIdAndUpdate").mockResolvedValue(template);

    const response = await request(app)
      .put(`/api/templates/${templateId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Weekly report", subject: "Weekly totals", body: "Orders: {{Orders}}" });

    expect(response.status).toBe(200);
    expect(response.body.template.body).toBe("Orders: {{Orders}}");
    expect(update).toHaveBeenCalledWith(
      templateId,
      { name: "Weekly report", subject: "Weekly totals", body: "Orders: {{Orders}}" },
      { new: true, runValidators: true }
    );
  });

  test("previews template placeholders for an authenticated user", async () => {
    const response = await request(app)
      .post("/api/templates/preview")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        subject: "Report for {{Date}}",
        body: "Sales: {{TotalSales}}",
        row: { Date: "2026-11-16", TotalSales: 42 }
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      preview: {
        subject: "Report for 2026-11-16",
        body: "Sales: 42"
      },
      missing: []
    });
  });

  test("deletes a template for an administrator", async () => {
    const templateId = "672000000000000000000004";
    jest.spyOn(Job, "find").mockReturnValue({ lean: async () => [] });
    jest.spyOn(Template, "findByIdAndDelete").mockResolvedValue({ _id: templateId });

    const response = await request(app)
      .delete(`/api/templates/${templateId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe("Template deleted.");
  });

  // A job pointing at a deleted template, list or query fails on every run, so these deletes are refused.
  test("refuses to delete a template or recipient list that a job uses", async () => {
    const id = "672000000000000000000004";
    jest.spyOn(Job, "find").mockReturnValue({ lean: async () => [{ name: "Daily Sales Report" }] });
    const templateDelete = jest.spyOn(Template, "findByIdAndDelete");
    const listDelete = jest.spyOn(RecipientList, "findByIdAndDelete");

    const template = await request(app).delete(`/api/templates/${id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(template.status).toBe(409);
    expect(template.body.message || template.body.error).toContain("Daily Sales Report");

    const list = await request(app).delete(`/api/recipient-lists/${id}`).set("Authorization", `Bearer ${adminToken}`);
    expect(list.status).toBe(409);
    expect(list.body.error).toContain("Daily Sales Report");

    expect(templateDelete).not.toHaveBeenCalled();
    expect(listDelete).not.toHaveBeenCalled();
  });

  test("rejects template changes from non-admin users", async () => {
    const response = await request(app)
      .post("/api/templates")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Report", subject: "Subject", body: "Body" });

    expect(response.status).toBe(403);
  });
});

describe("Run history API", () => {
  test("returns runs and jobs for an authenticated user", async () => {
    const jobId = "672000000000000000000001";
    const runId = "672000000000000000000002";
    const jobsQuery = {
      select: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{ _id: jobId, name: "Daily report" }])
    };
    const runsQuery = {
      sort: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{
        _id: runId,
        jobId: { _id: jobId, name: "Daily report" },
        startTime: new Date("2026-11-16T04:30:00Z"),
        status: "success",
        rowsFetched: 10,
        rowsMatched: 8,
        emailsSent: 8,
        skippedDuplicates: 0,
        failed: 0
      }])
    };
    jest.spyOn(Job, "find").mockReturnValue(jobsQuery);
    jest.spyOn(JobRun, "find").mockReturnValue(runsQuery);

    const response = await request(app)
      .get("/api/run-history")
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.jobs).toEqual([{ id: jobId, name: "Daily report" }]);
    expect(response.body.runs[0]).toMatchObject({
      id: runId,
      jobId,
      jobName: "Daily report",
      status: "success",
      rowsFetched: 10
    });
  });

  test("returns delivery logs for a selected run", async () => {
    const runId = "672000000000000000000002";
    const runQuery = {
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({
        _id: runId,
        jobId: { _id: "672000000000000000000001", name: "Daily report" },
        status: "success"
      })
    };
    const logsQuery = {
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([{
        _id: "672000000000000000000003",
        recipient: "recipient@example.test",
        subject: "Daily report",
        status: "sent",
        retryCount: 0
      }])
    };
    jest.spyOn(JobRun, "findById").mockReturnValue(runQuery);
    jest.spyOn(DeliveryLog, "find").mockReturnValue(logsQuery);

    const response = await request(app)
      .get(`/api/run-history/${runId}/deliveries`)
      .set("Authorization", `Bearer ${userToken}`);

    expect(response.status).toBe(200);
    expect(response.body.deliveryLogs).toHaveLength(1);
    expect(response.body.deliveryLogs[0]).toMatchObject({
      recipient: "recipient@example.test",
      status: "sent"
    });
  });
});
