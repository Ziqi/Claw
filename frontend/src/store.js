import { create } from 'zustand';

const useStore = create((set) => ({
  stats: null,
  setStats: (stats) => set({ stats }),

  currentTheater: 'default',
  setCurrentTheater: (theater) => set({ currentTheater: theater }),

  assets: [],
  setAssets: (assets) => set({ assets }),

  missionBriefing: "待命中... (Waiting for Commander Intent)",
  setMissionBriefing: (briefing) => set({ missionBriefing: briefing }),

  selectedIp: null,
  setSelectedIp: (ip) => set({ selectedIp: ip }),

  globalTargets: [],
  toggleGlobalTarget: (ip) => set((state) => ({
    globalTargets: state.globalTargets.includes(ip) 
      ? state.globalTargets.filter(t => t !== ip)
      : [...state.globalTargets, ip]
  })),
  setGlobalTargets: (targets) => set({ globalTargets: targets }),
  clearGlobalTargets: () => set({ globalTargets: [] }),

  view: 'HQ',  // ALFA RF MAC Targeting
  rfTargets: [],
  toggleRfTarget: (mac) => set(state => ({
    rfTargets: state.rfTargets.includes(mac)
      ? state.rfTargets.filter(t => t !== mac)
      : [...state.rfTargets, mac]
  })),
  clearRfTargets: () => set({ rfTargets: [] }),

  // View navigation: HQ (侦察), RC (Recon), AT (Asset), OP (Operations), RF (Radio), DP (Depot)
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

  agentMode: true,
  toggleAgentMode: () => set(state => ({ agentMode: !state.agentMode })),

  searchFilter: '',
  setSearchFilter: (s) => set({ searchFilter: s }),
  
  riskFilter: 'all',
  setRiskFilter: (r) => set({ riskFilter: r }),
  
  portFilter: null,
  setPortFilter: (p) => set({ portFilter: p })
}));

export default useStore;
