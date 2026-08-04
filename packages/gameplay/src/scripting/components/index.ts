import { Collider2D, RigidBody2D, SpriteRender } from "../../components";
import { defineScriptComponent } from "../core";

export const Collider = defineScriptComponent(Collider2D);
export type Collider = Collider2D;

export const RigidBody = defineScriptComponent(RigidBody2D);
export type RigidBody = RigidBody2D;

export const SpriteRenderer = defineScriptComponent(SpriteRender);
export type SpriteRenderer = SpriteRender;

export * from "./Transform";
export * from "./CharacterController";
