/**
 * Batch Operations Page
 * Manage favorites and watchlist in bulk
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BatchOperations } from "@/components/lists/batch-operations";

export default function BatchOperationsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Batch Operations</h1>
          <p className="text-muted-foreground">
            Manage your favorites and watchlist in bulk
          </p>
        </div>

        <BatchOperations />
      </main>
      <Footer />
    </>
  );
}
