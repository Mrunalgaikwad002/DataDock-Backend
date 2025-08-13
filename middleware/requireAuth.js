import { supabase } from "../config/supabase.js";

// Expect header: Authorization: Bearer <access_token>
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;
    if (!token) return res.status(401).json({ error: "Missing bearer token" });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    req.user = { id: data.user.id, email: data.user.email };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}


