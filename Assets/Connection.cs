using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Newtonsoft.Json;
using System.Net;
using System;
using System.Text;
using System.Net.Sockets;
using System.Threading;

public class NetworkInfo
{
	public string eventType { get; set; }
	public string playerId { get; set; }
	public string eventData { get; set; }
}

public class Connection : MonoBehaviour
{
	public GameObject playerPrefab;
	public GameObject cameraPrefab;
	private GameObject cameraInstance;
	private string playerId;
	private Dictionary<string, GameObject> map;
	public Vector3 offset;
	private ArrayList newEvents;
	private UdpClient udpClient;
	private Int32 connectionSequenceNumber = 1000;
	private Thread thread1;

	private ArrayList mySyncedAL;
	// Start is called before the first frame update

	private void udpReciever()
	{

		while (true)
		{
			IPEndPoint RemoteIpEndPoint = new IPEndPoint(IPAddress.Any, 0);

			Byte[] receiveBytes = udpClient.Receive(ref RemoteIpEndPoint);
			string returnData = Encoding.ASCII.GetString(receiveBytes);


			Debug.Log(returnData);

		}
		// mySyncedAL.Add(returnData);
		// Uses the IPEndPoint object to determine which of these two hosts responded.
		// Console.WriteLine("This is the message you received " +
		// 														 returnData.ToString());
		// Console.WriteLine("This message was sent from " +
		// 														RemoteIpEndPoint.Address.ToString() +
		// 														" on their port number " +
		// 														RemoteIpEndPoint.Port.ToString());

		// udpClient.Close();
	}

	void Start()
	{
		udpClient = new UdpClient(0);
		udpClient.Connect("localhost", 41234);
		thread1 = new Thread(udpReciever);
		thread1.Start();
		// newEvents = new ArrayList();
		// mySyncedAL = ArrayList.Synchronized( newEvents );


	}

	void Update()
	{

		// 	foreach (string newEvent in mySyncedAL){
		// 	Debug.Log(newEvent);
		// }

		// mySyncedAL.Clear();
		float xDirection = Input.GetAxis("Horizontal");
		float zDirection = Input.GetAxis("Vertical");

		NetworkInfo packet = new NetworkInfo();
		packet.playerId = playerId;
		packet.eventType = "MoveEvent";
		packet.eventData = xDirection.ToString() + "," + zDirection.ToString();
		string sendPacket = JsonConvert.SerializeObject(packet);
		connectionSequenceNumber += 1;
		Byte[] gameProtocol = Encoding.UTF8.GetBytes("5eee");

		Byte[] playerInfo = Encoding.UTF8.GetBytes(sendPacket);

		Byte[] sequenceNumberToSend = BitConverter.GetBytes(connectionSequenceNumber);

		if (BitConverter.IsLittleEndian)
		{
			Array.Reverse(sequenceNumberToSend);
		}

		Byte[] finalPacket = new Byte[gameProtocol.Length + sequenceNumberToSend.Length + playerInfo.Length];
		Buffer.BlockCopy(gameProtocol, 0, finalPacket, 0, gameProtocol.Length);
		Buffer.BlockCopy(sequenceNumberToSend, 0, finalPacket, gameProtocol.Length, sequenceNumberToSend.Length);
		Buffer.BlockCopy(playerInfo, 0, finalPacket, gameProtocol.Length + sequenceNumberToSend.Length, playerInfo.Length);

		udpClient.Send(finalPacket, finalPacket.Length);
	}
}