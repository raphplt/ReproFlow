import { z } from "zod";

const Id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const SyntheticNumber = z.string().regex(/^(?:|-?\d{1,8}(?:\.\d{1,4})?)$/);
export const ElementLocatorSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("testId"),
    value: z.string().min(1).max(100),
  }),
  z.strictObject({
    kind: z.literal("label"),
    value: z.string().min(1).max(100),
  }),
  z.strictObject({
    kind: z.literal("placeholder"),
    value: z.string().min(1).max(100),
  }),
  z.strictObject({
    kind: z.literal("role"),
    role: z.enum(["button", "spinbutton", "textbox", "heading", "link"]),
    name: z.string().min(1).max(100),
  }),
]);
export const ElementProjectSchema = z.strictObject({
  id: Id,
  policy: z.literal("synthetic-numeric-v1"),
  targets: z
    .record(
      Id,
      z.strictObject({
        locator: ElementLocatorSchema,
        allowedValues: z.array(SyntheticNumber).max(20),
      }),
    )
    .refine(
      (targets) =>
        Object.keys(targets).length > 0 && Object.keys(targets).length <= 20,
    ),
});
const Action = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("click"), target: Id }),
  z.strictObject({
    type: z.literal("fill"),
    target: Id,
    value: SyntheticNumber,
  }),
]);
export const ElementScenarioSchema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.enum(["component-value", "application-value"]),
    application: z
      .strictObject({
        entryPath: z
          .string()
          .regex(/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/)
          .max(200),
        readyTarget: ElementLocatorSchema,
        responsePath: z
          .string()
          .regex(/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/)
          .max(200),
        queryKey: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),
        queryValue: SyntheticNumber,
      })
      .optional(),
    project: ElementProjectSchema,
    viewport: z.strictObject({
      width: z.number().int().min(320).max(3840),
      height: z.number().int().min(240).max(2160),
    }),
    steps: z
      .array(
        z.strictObject({
          sequence: z.number().int().nonnegative(),
          action: Action,
        }),
      )
      .min(1)
      .max(50),
    oracle: z.strictObject({
      target: Id,
      expectedValue: SyntheticNumber,
      confirmedByUser: z.literal(true),
    }),
    observedValue: SyntheticNumber,
  })
  .superRefine((scenario, ctx) => {
    if (
      (scenario.kind === "application-value") !==
      Boolean(scenario.application)
    )
      ctx.addIssue({
        code: "custom",
        message: "Application fixture configuration must match scenario kind",
      });
    const target = scenario.project.targets[scenario.oracle.target];
    if (
      !Object.hasOwn(scenario.project.targets, scenario.oracle.target) ||
      !target?.allowedValues.includes(scenario.oracle.expectedValue) ||
      !target.allowedValues.includes(scenario.observedValue)
    )
      ctx.addIssue({
        code: "custom",
        message: "Oracle values must be explicitly allowed",
      });
    scenario.steps.forEach((step, index) => {
      const configured = scenario.project.targets[step.action.target];
      if (
        step.sequence !== index ||
        !Object.hasOwn(scenario.project.targets, step.action.target) ||
        !configured ||
        (step.action.type === "fill" &&
          !configured.allowedValues.includes(step.action.value))
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid or disallowed replay step",
        });
    });
  });
export const ElementEvidenceSchema = z.strictObject({
  outcome: z.enum([
    "passed",
    "oracle-failed",
    "replay-failed",
    "infrastructure-failed",
  ]),
  targetState: z.enum(["ok", "missing", "ambiguous", "unsupported", "masked"]),
  observedValue: SyntheticNumber.nullable(),
  runtimeError: z.boolean(),
  applicationReady: z.boolean().optional(),
  completedSteps: z.number().int().min(0).max(50),
  durationMs: z.number().nonnegative(),
  browserVersion: z
    .string()
    .regex(/^\d+(\.\d+)*$/)
    .nullable(),
});
export type ElementProject = z.infer<typeof ElementProjectSchema>;
export type ElementScenario = z.infer<typeof ElementScenarioSchema>;
export type ElementEvidence = z.infer<typeof ElementEvidenceSchema>;
export type ElementLocator = z.infer<typeof ElementLocatorSchema>;
