import { RigidBody2D, SpriteRender } from "../../components";
import { defineScriptComponent } from "../core";

export const RigidBody = defineScriptComponent(RigidBody2D);
export type RigidBody = RigidBody2D;

export const SpriteRenderer = defineScriptComponent(SpriteRender);
export type SpriteRenderer = SpriteRender;

export * from "./Transform";
