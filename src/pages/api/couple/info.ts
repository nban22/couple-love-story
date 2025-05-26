import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { getDatabase } from "../../../lib/database";

/**
 * RESTful API endpoint with async database integration
 * Critical Fix: Handles Promise-based database instance with proper error boundaries
 * Performance: Efficient async/await pattern prevents blocking operations
 */

interface CoupleInfoRequest {
  male_name?: string;
  female_name?: string;
  love_start_date?: string;
  male_birthday?: string;
  female_birthday?: string;
}

// Input validation schema with regex patterns for data integrity
const VALIDATION_PATTERNS = {
  name: /^[a-zA-ZÀ-ỹ\s]{1,50}$/u, // Unicode support for Vietnamese names
  date: /^\d{4}-\d{2}-\d{2}$/, // ISO date format YYYY-MM-DD
  birthday: /^\d{2}-\d{2}$/, // MM-DD format for recurring birthdays
} as const;

/**
 * Validation function with comprehensive error accumulation
 * Performance: Single-pass validation with detailed feedback
 */
function validateCoupleInfo(data: CoupleInfoRequest): string[] {
  const validationErrors: string[] = [];

  // Fix: Corrected syntax error - missing validationErrors.push()
  if (data.male_name && !VALIDATION_PATTERNS.name.test(data.male_name)) {
    validationErrors.push("Invalid male name format");
  }
  if (data.female_name && !VALIDATION_PATTERNS.name.test(data.female_name)) {
    validationErrors.push("Invalid female name format");
  }
  if (data.love_start_date && !VALIDATION_PATTERNS.date.test(data.love_start_date)) {
    validationErrors.push("Invalid love start date format (use YYYY-MM-DD)");
  }
  if (data.male_birthday && !VALIDATION_PATTERNS.birthday.test(data.male_birthday)) {
    validationErrors.push("Invalid male birthday format (use MM-DD)");
  }
  if (data.female_birthday && !VALIDATION_PATTERNS.birthday.test(data.female_birthday)) {
    validationErrors.push("Invalid female birthday format (use MM-DD)");
  }

  return validationErrors;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS headers for cross-origin compatibility
  console.log("API Request:", req.method, req.url);
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle preflight requests efficiently
  if (req.method === "OPTIONS") {
    return res.status(200).json({
      message: "CORS preflight request successful",
    });
  }

  try {
    // Critical Fix: Await the async database initialization
    // This handles the Promise<DatabaseManager> return type
    const db = await getDatabase();

    switch (req.method) {
      case "GET":
        /**
         * Public read endpoint - optimized for performance
         * Fix: Database methods remain synchronous after initialization
         */
        const coupleInfo = await db.getCoupleInfo();
        
        if (!coupleInfo) {
          return res.status(404).json({
            error: "Couple information not found",
            code: "COUPLE_NOT_FOUND",
          });
        }
        
        return res.status(200).json(coupleInfo);

      case "PUT":
        /**
         * Authenticated update endpoint with comprehensive validation
         * Security: Session validation prevents unauthorized access
         */
        const session = await getServerSession(req, res, authOptions);

        console.log("Session:", session);

        if (!session) {
          return res.status(401).json({
            error: "Authentication required",
            code: "UNAUTHORIZED",
          });
        }

        // Input validation with detailed error collection
        const updateData: CoupleInfoRequest = req.body;
        const validationErrors = validateCoupleInfo(updateData);

        if (validationErrors.length > 0) {
          return res.status(400).json({
            error: "Validation failed",
            details: validationErrors,
            code: "VALIDATION_ERROR",
          });
        }

        // Database update operation with error handling
        const updateSuccess = await db.updateCoupleInfo(updateData);
        
        if (!updateSuccess) {
          return res.status(500).json({
            error: "Failed to update couple information",
            code: "UPDATE_FAILED",
          });
        }

        // Return synchronized data for client state management
        const updatedInfo = await db.getCoupleInfo();
        
        if (!updatedInfo) {
          return res.status(500).json({
            error: "Failed to retrieve updated information",
            code: "RETRIEVAL_FAILED",
          });
        }
        
        return res.status(200).json(updatedInfo);

      default:
        res.setHeader("Allow", ["GET", "PUT", "OPTIONS"]);
        return res.status(405).json({
          error: `Method ${req.method} not allowed`,
          code: "METHOD_NOT_ALLOWED",
        });
    }
  } catch (error) {
    /**
     * Enhanced error handling for async database initialization
     * Critical: Handles database initialization failures gracefully
     */
    console.error("API Error in /api/couple/info:", {
      method: req.method,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Specific error handling for database initialization issues
    if (error instanceof Error) {
      if (error.message.includes('Database not initialized')) {
        return res.status(503).json({
          error: "Database service temporarily unavailable",
          code: "DATABASE_INITIALIZING",
        });
      }
      
      if (error.message.includes('server-side only')) {
        return res.status(500).json({
          error: "Server environment configuration error",
          code: "SERVER_ENVIRONMENT_ERROR",
        });
      }
      
      if (error.message.includes('Database initialization failed')) {
        return res.status(503).json({
          error: "Database service unavailable",
          code: "DATABASE_UNAVAILABLE",
        });
      }
    }

    return res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}