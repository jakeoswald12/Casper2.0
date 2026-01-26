import { Route, Switch } from 'wouter';
import { Toaster } from 'sonner';
import { Dashboard } from './pages/Dashboard';
import { Studio } from './pages/Studio';
import { Landing } from './pages/Landing';

function App() {
  return (
    <>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/studio/:bookId" component={Studio} />
        <Route>
          <div className="flex items-center justify-center min-h-screen">
            <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
          </div>
        </Route>
      </Switch>
      <Toaster position="bottom-right" richColors />
    </>
  );
}

export default App;
