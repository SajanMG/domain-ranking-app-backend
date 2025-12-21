import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'domain_ranks' })
export class DomainRank extends Model {
  @Column({ type: DataType.STRING, allowNull: false })
  declare domain: string;

  @Column({ type: DataType.DATEONLY, allowNull: false })
  declare date: string;

  @Column({ type: DataType.INTEGER, allowNull: false })
  declare rank: number;
}
