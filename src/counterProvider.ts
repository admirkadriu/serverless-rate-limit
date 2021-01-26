import AWS from 'aws-sdk';

import { CounterItem } from './interfaces/CounterItem';

const Client = new AWS.DynamoDB.DocumentClient();

export default class CounterProvider {
  private readonly table: string;

  private readonly counterExpireMinutes: number;

  /**
   * @param table: The DynamoDB table identifier
   * @param counterExpireMinutes: ttl for a specific key
   */
  constructor(table: string, counterExpireMinutes: number = 1) {
    this.table = table;
    this.counterExpireMinutes = counterExpireMinutes;
  }

  async incrementSuspicious(
    id: string,
  ): Promise<CounterItem> {
    const currentSeconds = new Date().getTime() / 1000;
    const data = await Client.update({
      TableName: this.table,
      Key: {
        id,
      },
      UpdateExpression:
        'add suspiciousCount :value set exptime = if_not_exists(exptime, :exptime)',
      ExpressionAttributeValues: {
        ':value': 1,
        ':exptime': Math.round(currentSeconds + this.counterExpireMinutes * 60),
      },
      ReturnValues: 'ALL_NEW',
    }).promise();

    const expireSeconds = data.Attributes.exptime;

    const date = new Date(0);

    date.setSeconds(expireSeconds - currentSeconds);

    const counterItem: CounterItem = {
      id,
      count: data.Attributes.count || 0,
      suspiciousCount: data.Attributes.suspiciousCount || 0,
      exptime: Math.round(currentSeconds + this.counterExpireMinutes * 60),
    };

    if (expireSeconds < currentSeconds) {
      const expireTime = Math.round(currentSeconds + this.counterExpireMinutes * 60);

      await Client.update({
        TableName: this.table,
        Key: {
          id,
        },
        UpdateExpression:
          'set suspiciousCount = :scount, #count = :count, exptime = :exptime',
        ExpressionAttributeNames: {
          '#count': 'count',
        },
        ExpressionAttributeValues: {
          ':scount': 1,
          ':count': 0,
          ':exptime': expireTime,
        },
        ReturnValues: 'ALL_NEW',
      }).promise();

      counterItem.count = 0;
      counterItem.suspiciousCount = 1;
    }

    return counterItem;
  }

  async increment(
    id: string,
  ): Promise<CounterItem> {
    const currentSeconds = new Date().getTime() / 1000;
    const data = await Client.update({
      TableName: this.table,
      Key: {
        id,
      },
      UpdateExpression:
        'add #value :value set exptime = if_not_exists(exptime, :exptime)',
      ExpressionAttributeNames: {
        '#value': 'count',
      },
      ExpressionAttributeValues: {
        ':value': 1,
        ':exptime': Math.round(currentSeconds + this.counterExpireMinutes * 60),
      },
      ReturnValues: 'ALL_NEW',
    }).promise();

    const expireSeconds = data.Attributes.exptime;

    const date = new Date(0);

    date.setSeconds(expireSeconds - currentSeconds);

    const counterItem: CounterItem = {
      id,
      count: data.Attributes.count || 0,
      suspiciousCount: data.Attributes.suspiciousCount || 0,
      exptime: Math.round(currentSeconds + this.counterExpireMinutes * 60),
    };

    if (expireSeconds < currentSeconds) {
      const expireTime = Math.round(currentSeconds + this.counterExpireMinutes * 60);

      await Client.update({
        TableName: this.table,
        Key: {
          id,
        },
        UpdateExpression:
          'set #count = :count, suspiciousCount = :scount, exptime = :exptime',
        ExpressionAttributeNames: {
          '#count': 'count',
        },
        ExpressionAttributeValues: {
          ':count': 1,
          ':scount': 0,
          ':exptime': expireTime,
        },
        ReturnValues: 'ALL_NEW',
      }).promise();

      counterItem.count = 1;
      counterItem.suspiciousCount = 0;
    }

    return counterItem;
  }

  async get(
    id: string,
  ): Promise<CounterItem> {
    const currentSeconds = new Date().getTime() / 1000;
    const data = await Client.get({
      TableName: this.table,
      Key: {
        id,
      },
    }).promise();

    return {
      id,
      count: data.Item.count || 0,
      suspiciousCount: data.Item.suspiciousCount || 0,
      exptime: Math.round(currentSeconds + this.counterExpireMinutes * 60),
    };
  }
}
