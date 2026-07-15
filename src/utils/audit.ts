import { auditApi } from "@/lib/api";
import { generateId } from "@/lib/utils";

export const logAudit = async (actorName: string, actorRole: string, action: string, details: string) => {
  try {
    await auditApi.save({
      id: generateId(),
      action: action,
      changed_by_name: actorName,
      changed_by: actorRole,
      new_values: details,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error logging audit to local server:", error);
  }
};
