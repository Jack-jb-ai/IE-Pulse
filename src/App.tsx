import Sidebar from "@/components/layout/Sidebar";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider, useApp } from "@/context/AppContext";
import { prefetchOleData } from "@/hooks/ole/useOleData";
import { BUILD_BASENAME, includesApp } from "@/lib/buildContext";
import BayDetail from "@/pages/BayDetail";
import CycleTimeWorkcell from "@/pages/cycletime/CycleTimeWorkcell";
import CycleTimeWorkcells from "@/pages/cycletime/CycleTimeWorkcells";
import IncompletionReport from "@/pages/cycletime/IncompletionReport";
import IncompletionReportDetail from "@/pages/cycletime/IncompletionReportDetail";
import PlantRunnerDashboard from "@/pages/cycletime/PlantRunnerDashboard";
import Documents from "@/pages/Documents";
import EBuildPlan from "@/pages/ebuild/eBuildPlan";
import FloorMap from "@/pages/FloorMap";
import MachineMoverHome from "@/pages/machinemover/MachineMoverHome";
import MachineMoverApprovals from "@/pages/machinemover/MachineMoverApprovals";
import MachineMoverReports from "@/pages/machinemover/MachineMoverReports";
import BayManagement from "@/pages/fsms/BayManagement";
import LayoutEditor from "@/pages/fsms/LayoutEditor";
import FsmsDashboard from "@/pages/fsms/FsmsDashboard";
import FsmsPlants from "@/pages/fsms/FsmsPlants";
import FsmsSubmissions from "@/pages/fsms/FsmsSubmissions";
import GlobalOverview from "@/pages/GlobalOverview";
import AssignModules from "@/pages/iebaseline/AssignModules";
import IEBaseline from "@/pages/iebaseline/IEBaseline";
import IEBaselineEdit from "@/pages/iebaseline/IEBaselineEdit";
import ModuleAdmin from "@/pages/iebaseline/ModuleAdmin";
import ModuleOverview from "@/pages/iebaseline/ModuleOverview";
import IPKConfig from "@/pages/ipk/IPKConfig";
import IPKDashboard from "@/pages/ipk/IPKDashboard";
import IPKHistory from "@/pages/ipk/IPKHistory";
import IPKHome from "@/pages/ipk/IPKHome";
import IPKMatrix from "@/pages/ipk/IPKMatrix";
import IPKResults from "@/pages/ipk/IPKResults";
import IPKSimulate from "@/pages/ipk/IPKSimulate";
import IPKWorkcells from "@/pages/ipk/IPKWorkcells";
import KioskMode from "@/pages/KioskMode";
import LBRAssemblyDetail from "@/pages/lbr/LBRAssemblyDetail";
import LBRGlobalConfig from "@/pages/lbr/LBRGlobalConfig";
import LBRHome from "@/pages/lbr/LBRHome";
import LBRPlaybookDetail from "@/pages/lbr/LBRPlaybookDetail";
import LBRWorkcellConfig from "@/pages/lbr/LBRWorkcellConfig";
import LBRWorkcellProfile from "@/pages/lbr/LBRWorkcellProfile";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import OLE4QReport from "@/pages/ole/OLE4QReport";
import OlePlantReport from "@/pages/ole/OlePlantReport";
import OLESmh from "@/pages/ole/OLESmh";
import OleWorkcellReport from "@/pages/ole/OleWorkcellReport";
import OleWowAnalysis from "@/pages/ole/OleWowAnalysis";
import Plants from "@/pages/Plants";
import PPQT2AWorkcell from "@/pages/ppqt/dash2/PPQT2AWorkcell";
import PPQT2AWorkcells from "@/pages/ppqt/dash2/PPQT2AWorkcells";
import PPQTAssemblyDetail from "@/pages/ppqt/PPQTAssemblyDetail";
import PPQTConfig from "@/pages/ppqt/PPQTConfig";
import PPQTHome from "@/pages/ppqt/PPQTHome";
import PPQTProcessDetail from "@/pages/ppqt/PPQTProcessDetail";
import PPQTSubWorkcenterProfile from "@/pages/ppqt/PPQTSubWorkcenterProfile";
import PPQTWorkcellProfile from "@/pages/ppqt/PPQTWorkcellProfile";
import PPQTWorkcells from "@/pages/ppqt/PPQTWorkcells";
import Reports from "@/pages/Reports";
import ReportA from "@/pages/ReportA";
import Settings from "@/pages/Settings";
import WorkcellsTable from "@/pages/WorkcellsTable";
import WorkcellView from "@/pages/WorkcellView";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import MapPage from "./pages/MapPage";
import DowntimeManagement from "./pages/ole/DowntimeManagement";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={BUILD_BASENAME}>
        <AppProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/kiosk/:bayId" element={<KioskMode />} />
            <Route path="/*" element={<AppShell />} />
          </Routes>
        </AppProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (!includesApp('ole')) return;
    if (pathname === '/' || pathname === '/ole/map' || pathname.startsWith('/ole/report')) {
      prefetchOleData();
    }
  }, [pathname]);
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* <Header /> */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomeRedirect />} />

            {includesApp('ole') && <>
              <Route path="/ole" element={<Navigate to="/ole/map" replace />} />
              <Route path="/ole/map" element={<MapPage />} />
              <Route path="/ole/smh" element={<OLESmh />} />
              <Route path="/ole/4q" element={<OLE4QReport />} />
              <Route path="/ole/analysis" element={<OleWowAnalysis />} />
              <Route path="/ole/report" element={<OlePlantReport />} />
              <Route path="/ole/report/wc/:workcell" element={<OleWorkcellReport />} />
              <Route path="/ole/downtime" element={<DowntimeManagement />} />
            </>}

            {includesApp('pulse') && <>
              <Route path="/pulse" element={<Navigate to="/pulse/overview" replace />} />
              <Route path="/pulse/overview" element={<GlobalOverview />} />
              <Route path="/pulse/plants" element={<Plants />} />
              <Route path="/pulse/workcells" element={<WorkcellsTable />} />
              <Route path="/pulse/workcell/:id" element={<WorkcellView />} />
              <Route path="/pulse/bay/:id" element={<BayDetail />} />
              <Route path="/pulse/reports" element={<Reports />} />
              <Route path="/pulse/report-a" element={<ReportA />} />
              <Route path="/pulse/documents" element={<Documents />} />
            </>}

            {includesApp('fsms') && <>
              <Route path="/fsms" element={<Navigate to="/fsms/dashboard" replace />} />
              <Route path="/fsms/dashboard" element={<FsmsDashboard />} />
              <Route path="/fsms/submissions" element={<FsmsSubmissions />} />
              <Route path="/fsms/plants" element={<FsmsPlants />} />
              <Route path="/fsms/floor-map" element={<FloorMap />} />
              <Route path="/fsms/editor" element={<LayoutEditor />} />
              <Route path="/fsms/bays" element={<BayManagement />} />
            </>}

            {includesApp('cycle-time') && <>
              <Route path="/cycle-time" element={<Navigate to="/cycle-time/workcells" replace />} />
              <Route path="/cycle-time/workcells" element={<CycleTimeWorkcells />} />
              <Route path="/cycle-time/wc/:customer" element={<CycleTimeWorkcell />} />
              <Route path="/cycle-time/incompletion" element={<IncompletionReport />} />
              <Route path="/cycle-time/incompletion/:customer" element={<IncompletionReportDetail />} />
              <Route path="/cycle-time/plant-runners" element={<PlantRunnerDashboard />} />
            </>}

            {includesApp('ppqt') && <>
              <Route path="/ppqt/" element={<PPQT2AWorkcells />} />
              <Route path="/ppqt/workcell" element={<PPQTWorkcells />} />
              <Route path="/ppqt/workcell/:workcell" element={<PPQTWorkcellProfile />} />
              <Route path="/ppqt/workcell/:workcell/swc/:subWorkcenter" element={<PPQTSubWorkcenterProfile />} />
              <Route path="/ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process" element={<PPQTProcessDetail />} />
              <Route path="/ppqt/workcell/:workcell/swc/:subWorkcenter/proc/:process/asm/:assembly" element={<PPQTAssemblyDetail />} />
              <Route path="/ppqt/config" element={<PPQTConfig />} />
              {/* Main dashboard — league table → tabbed workcell page (DASH / Report / Triage) */}
              <Route path="/ppqt/dash2" element={<PPQTHome />} />
              <Route path="/ppqt/dash2a/:workcell" element={<PPQT2AWorkcell />} />
            </>}

            {includesApp('ipk') && <>
              <Route path="/ipk" element={<IPKHome />} />
              <Route path="/ipk/workcells" element={<IPKWorkcells />} />
              <Route path="/ipk/:workcell" element={<IPKDashboard />} />
              <Route path="/ipk/:workcell/simulate" element={<IPKSimulate />} />
              <Route path="/ipk/:workcell/results/:runId" element={<IPKResults />} />
              <Route path="/ipk/:workcell/history" element={<IPKHistory />} />
              <Route path="/ipk/:workcell/matrix" element={<IPKMatrix />} />
              <Route path="/ipk/:workcell/config" element={<IPKConfig />} />
            </>}

            {includesApp('lbr') && <>
              <Route path="/lbr" element={<LBRHome />} />
              <Route path="/lbr/config" element={<LBRGlobalConfig />} />
              <Route path="/lbr/:workcell" element={<LBRWorkcellProfile />} />
              <Route path="/lbr/:workcell/config" element={<LBRWorkcellConfig />} />
              <Route path="/lbr/:workcell/:assembly" element={<LBRAssemblyDetail />} />
              <Route path="/lbr/:workcell/:assembly/:playbook" element={<LBRPlaybookDetail />} />
            </>}

            {includesApp('ebuild') && <>
              <Route path="/ebuild" element={<EBuildPlan />} />
            </>}

            {includesApp('machine-mover') && <>
              <Route path="/machine-mover" element={<MachineMoverHome />} />
              <Route path="/machine-mover/approvals" element={<MachineMoverApprovals />} />
              <Route path="/machine-mover/reports" element={<MachineMoverReports />} />
            </>}

            {includesApp('iebaseline') && <>
              <Route path="/iebaseline" element={<IEBaseline />} />
              <Route path="/iebaseline/edit" element={<IEBaselineEdit />} />
              <Route path="/iebaseline/assign" element={<AssignModules />} />
              <Route path="/iebaseline/module/:moduleId" element={<ModuleOverview />} />
              <Route path="/iebaseline/admin/:moduleId" element={<ModuleAdmin />} />
            </>}

            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

/** Sends `/` to the active app's first nav item (so each build lands on its own home). */
function HomeRedirect() {
  const { activeApp } = useApp();
  const to = activeApp.navItems[0]?.to ?? '/map';
  return <Navigate to={to} replace />;
}

export default App;
