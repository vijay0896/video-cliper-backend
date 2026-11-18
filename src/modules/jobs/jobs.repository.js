/**
 * In-memory Job Repository
 * Designed to be easily swapped with Sequelize ORM / PostgreSQL / SQLite if desired.
 */
class JobRepository {
  constructor() {
    /** @type {Map<string, object>} */
    this.jobs = new Map();
  }

  create(job) {
    this.jobs.set(job.id, job);
    return job;
  }

  findById(id) {
    return this.jobs.get(id) || null;
  }

  findAll() {
    return Array.from(this.jobs.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  update(id, partial) {
    const job = this.findById(id);
    if (!job) return null;
    const updated = {
      ...job,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
    this.jobs.set(id, updated);
    return updated;
  }

  addLog(id, logLine) {
    const job = this.findById(id);
    if (!job) return;
    job.logs.push(`[${new Date().toLocaleTimeString()}] ${logLine}`);
    job.updatedAt = new Date().toISOString();
  }
}

export const jobRepository = new JobRepository();

