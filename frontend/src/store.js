import { create } from 'zustand';

const useStore = create((set) => ({
  stats: null,
  setStats: (stats) => set({ stats }),

  assets: [],
  setAssets: (assets) => set({ assets }),

  selectedIp: null,
  setSelectedIp: (ip) => set({ selectedIp: ip }),

  view: 'RC',  // RC (Recon), AT (Assets), OP (Ops), VS (Visual), AM (Armory), C2 (C2/Sliver)
  setView: (view) => set({ view }),

  aiWidth: 380,
  setAiWidth: (width) => set({ aiWidth: width }),

  spotlightOpen: false,
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),

  externalCommand: null,
  setExternalCommand: (cmd) => set({ externalCommand: cmd }),

  terminalOpen: true,
  setTerminalOpen: (open) => set({ terminalOpen: open }),

  consoleTab: 'xterm', // xterm, output
  setConsoleTab: (tab) => set({ consoleTab: tab }),

  terminalHeight: 240,
  setTerminalHeight: (h) => set({ terminalHeight: h }),

  sudoPassword: null,
  setSudoPassword: (pwd) => set({ sudoPassword: pwd }),

  searchFilter: '',
  setSearchFilter: (s) => set({ searchFilter: s }),
  
  riskFilter: 'all',
  setRiskFilter: (r) => set({ riskFilter: r }),
  
  portFilter: null,
  setPortFilter: (p) => set({ portFilter: p })
}));

export default useStore;
