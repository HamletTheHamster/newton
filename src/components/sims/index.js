import { ParallelWiresSim } from "./ParallelWiresSim.jsx";
import { TwistedPairSim } from "./TwistedPairSim.jsx";
import { BulbsCircuitSim } from "./BulbsCircuitSim.jsx";
import { RCCircuitSim } from "./RCCircuitSim.jsx";
import { GaussSurfaceSim } from "./GaussSurfaceSim.jsx";
import { ChargeInBSim } from "./ChargeInBSim.jsx";

// Interactive simulations a quiz can carry for its whole sitting. A quiz opts in with
// `simulation: "<id>"` on the quiz object (src/courses/*.js), and a question may name its own
// `simulation` to replace the quiz's while it is being asked; the quiz screen (App.jsx) then
// shows the matching component beside the chat on a wide screen and above it on a narrow one.
// A simulation is a discovery tool: it records nothing and grades nothing (unless a part opts
// into answering from it with `simAnswer`, and even then a pick only ever prompts for the
// reasoning). Register a new one here; the course file names only the id.
export const QUIZ_SIMULATIONS = {
  parallelWires: { title: "Two long parallel wires", Component: ParallelWiresSim },
  twistedPair: { title: "A twisted pair", Component: TwistedPairSim },
  bulbsCircuit: { title: "Bulbs on a battery", Component: BulbsCircuitSim },
  rcCircuit: { title: "Charging a capacitor", Component: RCCircuitSim },
  gaussSurface: { title: "A charge inside a closed surface", Component: GaussSurfaceSim },
  chargeInB: { title: "A charge in a magnetic field", Component: ChargeInBSim },
};

export const simulationFor = id => (id && QUIZ_SIMULATIONS[id]) || null;
