/** Shared by the route and navigation preparation; import() deduplicates the module. */
export function loadApplicationsPage() {
  return import('@/routes/applications-page').then((module) => ({
    default: module.ApplicationsPage,
  }))
}
