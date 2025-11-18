import { Entity, Column, PrimaryColumn, UpdateDateColumn } from "typeorm";
import { PlcValue } from "../plc.types";

@Entity("plc_cache")
export class PlcCache {
  @PrimaryColumn()
  key: string;

  @Column("simple-json")
  value: PlcValue;

  @UpdateDateColumn()
  timestamp: Date;

  @Column({ nullable: true })
  error?: string;
}
