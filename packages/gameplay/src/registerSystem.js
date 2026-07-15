export function registerSystem(lane, world, system, spec) {
    return lane.add((ctx) => system.update({ world, dt: ctx.dt }), spec);
}
//# sourceMappingURL=registerSystem.js.map