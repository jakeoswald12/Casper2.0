import { Route, Switch } from 'wouter';
import { Toaster } from 'sonner';
import { Dashboard } from './pages/Dashboard';
import { Studio } from './pages/Studio';
import { Landing } from './pages/Landing';
import { Settings } from './pages/Settings';
import { Library } from './pages/Library';
import { LibraryBook } from './pages/LibraryBook';
import { Pricing } from './pages/Pricing';
import { Login } from './pages/Login';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/studio/:bookId" component={Studio} />
        <Route path="/settings" component={Settings} />
        <Route path="/library" component={Library} />
        <Route path="/library/:bookId" component={LibraryBook} />
        <Route path="/pricing" component={Pricing} />
        <Route>
          <div className="flex items-center justify-center min-h-screen">
            <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
          </div>
        </Route>
      </Switch>
      <Toaster position="bottom-right" richColors />
    </ErrorBoundary>
  );
}

export default App;
